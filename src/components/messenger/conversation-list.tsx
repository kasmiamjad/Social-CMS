"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, ChevronRight } from "lucide-react";

export interface MessengerConversationSummary {
  id: string;
  psid: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  is_archived: boolean;
}

interface ConversationListProps {
  conversations: MessengerConversationSummary[];
}

export function MessengerConversationList({ conversations }: ConversationListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
            <MessageCircle size={20} strokeWidth={1.8} className="text-foreground" />
          </div>
          <div>
            <CardTitle>Messenger</CardTitle>
            <CardDescription>
              {conversations.length === 0
                ? "No conversations yet — they appear when people message your Page."
                : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium text-foreground">No incoming messages yet</p>
          <p className="text-xs text-text-muted mt-1 max-w-md">
            Once someone messages your Facebook Page, it&apos;ll appear here. Webhook URL:{" "}
            <code className="px-1.5 py-0.5 rounded bg-surface text-foreground font-mono text-[10px]">
              /api/v1/messenger/webhook
            </code>
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border -mx-6">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <Link
                href={`/messenger/conversations/${conv.id}`}
                className="block px-6 py-3.5 hover:bg-surface transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-foreground truncate">
                        {conv.contact_name?.trim() || `Messenger user ${conv.psid.slice(-6)}`}
                      </div>
                      {conv.unread_count > 0 && (
                        <Badge variant="processing" className="ml-auto">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                    {conv.last_message_preview && (
                      <p className="mt-0.5 text-xs text-text-muted truncate">
                        {conv.last_message_preview}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {conv.last_message_at && (
                      <div className="text-[10px] text-text-muted whitespace-nowrap">
                        {formatRelativeTime(conv.last_message_at)}
                      </div>
                    )}
                    <ChevronRight
                      size={14}
                      strokeWidth={1.8}
                      className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
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
