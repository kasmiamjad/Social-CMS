"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Search, X } from "lucide-react";

export interface WhatsAppGroupConversationSummary {
  id: string;
  group_jid: string;
  group_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
}

interface GroupConversationListProps {
  conversations: WhatsAppGroupConversationSummary[];
}

/** Circular initial-letter avatar for a group, distinguished from ContactAvatar's 1:1 tint by a neutral color. */
function GroupAvatar({ name }: { name: string | null }) {
  const initial = name?.trim()?.[0]?.toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
      {initial ? (
        <span className="text-sm font-semibold">{initial}</span>
      ) : (
        <Users size={16} strokeWidth={1.8} />
      )}
    </div>
  );
}

export function GroupConversationList({ conversations }: GroupConversationListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = c.group_name?.toLowerCase() ?? "";
      const preview = c.last_message_preview?.toLowerCase() ?? "";
      return name.includes(q) || preview.includes(q);
    });
  }, [conversations, query]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
            <Users size={20} strokeWidth={1.8} className="text-foreground" />
          </div>
          <div>
            <CardTitle>WhatsApp Groups</CardTitle>
            <CardDescription>
              {conversations.length === 0
                ? "No group messages yet."
                : `${conversations.length} group${conversations.length === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {conversations.length > 0 && (
        <div className="relative mb-3">
          <Search size={14} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by group name or message…"
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-surface-elevated text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
            <Users size={22} strokeWidth={1.8} className="text-text-muted" />
          </div>
          <p className="text-sm font-medium text-foreground">No group messages yet</p>
          <p className="text-xs text-text-muted mt-1 max-w-md">
            Groups the linked WhatsApp number is a member of will appear here once a message comes in.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-text-muted">No groups match &quot;{query}&quot;.</div>
      ) : (
        <ul className="divide-y divide-border -mx-6">
          {filtered.map((conv) => (
            <li key={conv.id}>
              <Link
                href={`/whatsapp-groups/${conv.id}`}
                className="flex items-center gap-3 px-6 py-3.5 hover:bg-surface transition-colors"
              >
                <GroupAvatar name={conv.group_name} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">
                    {conv.group_name?.trim() || "Unnamed group"}
                  </div>
                  {conv.last_message_preview && (
                    <p className="mt-0.5 text-xs text-text-muted truncate">{conv.last_message_preview}</p>
                  )}
                </div>
                {conv.last_message_at && (
                  <div className="text-[10px] text-text-muted whitespace-nowrap shrink-0">
                    {formatRelativeTime(conv.last_message_at)}
                  </div>
                )}
              </Link>
            </li>
          ))}
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
