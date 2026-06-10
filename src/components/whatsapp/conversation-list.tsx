"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Phone } from "lucide-react";

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
      ) : (
        <ul className="divide-y divide-border -mx-6">
          {conversations.map((conv) => (
            <li key={conv.id} className="px-6 py-3.5 hover:bg-surface transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-foreground truncate">
                      {conv.contact_name?.trim() || conv.contact_phone}
                    </div>
                    {conv.contact_name?.trim() && (
                      <span className="text-xs text-text-muted font-mono">
                        {conv.contact_phone}
                      </span>
                    )}
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
                {conv.last_message_at && (
                  <div className="text-[10px] text-text-muted whitespace-nowrap pt-0.5">
                    {formatRelativeTime(conv.last_message_at)}
                  </div>
                )}
              </div>
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
