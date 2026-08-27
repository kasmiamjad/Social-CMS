"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageCircle, Phone, Search, X } from "lucide-react";
import { ContactAvatar } from "./contact-avatar";

export interface WhatsAppConversationSummary {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  is_archived: boolean;
}

interface ConversationListProps {
  conversations: WhatsAppConversationSummary[];
}

export function ConversationList({ conversations }: ConversationListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = c.contact_name?.toLowerCase() ?? "";
      const preview = c.last_message_preview?.toLowerCase() ?? "";
      return name.includes(q) || c.contact_phone.toLowerCase().includes(q) || preview.includes(q);
    });
  }, [conversations, query]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
              <MessageCircle size={20} strokeWidth={1.8} className="text-foreground" />
            </div>
            <div>
              <CardTitle>Conversations</CardTitle>
              <CardDescription>
                {conversations.length === 0
                  ? "No conversations yet. They&apos;ll appear here when customers message you."
                  : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      {conversations.length > 0 && (
        <div className="relative mb-3">
          <Search size={14} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, or message…"
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-surface-elevated text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-whatsapp/30 focus:border-whatsapp"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          )}
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-3">
            <Phone size={22} strokeWidth={1.8} className="text-text-muted" />
          </div>
          <p className="text-sm font-medium text-foreground">No incoming messages yet</p>
          <p className="text-xs text-text-muted mt-1 max-w-md">
            Once a customer sends a message to your WhatsApp business number, it&apos;ll appear here.
            Webhook URL:{" "}
            <code className="px-1.5 py-0.5 rounded bg-surface text-foreground font-mono text-[10px]">
              /api/v1/whatsapp/webhook
            </code>
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-text-muted">No conversations match &quot;{query}&quot;.</div>
      ) : (
        <ul className="divide-y divide-border -mx-6">
          {filtered.map((conv) => {
            const unread = conv.unread_count > 0;
            return (
              <li key={conv.id}>
                <Link
                  href={`/whatsapp/conversations/${conv.id}`}
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-surface transition-colors"
                >
                  <ContactAvatar name={conv.contact_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`text-sm truncate ${unread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}
                      >
                        {conv.contact_name?.trim() || conv.contact_phone}
                      </div>
                      {conv.contact_name?.trim() && (
                        <span className="text-xs text-text-muted font-mono">
                          {conv.contact_phone}
                        </span>
                      )}
                    </div>
                    {conv.last_message_preview && (
                      <p
                        className={`mt-0.5 text-xs truncate ${unread ? "text-foreground/80 font-medium" : "text-text-muted"}`}
                      >
                        {conv.last_message_preview}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 pt-0.5 shrink-0">
                    {conv.last_message_at && (
                      <div className={`text-[10px] whitespace-nowrap ${unread ? "text-whatsapp font-semibold" : "text-text-muted"}`}>
                        {formatRelativeTime(conv.last_message_at)}
                      </div>
                    )}
                    {unread && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-whatsapp text-white text-[10px] font-semibold">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
