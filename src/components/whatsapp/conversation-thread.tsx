import Link from "next/link";
import { ArrowLeft, Bot, Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ManualReplyInput } from "./manual-reply-input";
import { AiPauseToggle } from "./ai-pause-toggle";
import { AutoRefresh } from "./auto-refresh";
import { ConvertToLeadButton } from "./convert-to-lead-button";

export interface WhatsAppConversationDetail {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message_at: string | null;
  created_at: string;
  ai_paused: boolean;
}

export interface WhatsAppMessageRow {
  id: string;
  wa_message_id: string | null;
  direction: "inbound" | "outbound";
  message_type: string;
  body: string | null;
  media_url: string | null;
  status: string;
  ai_generated: boolean;
  sent_at: string | null;
  created_at: string;
}

interface ConversationThreadProps {
  conversation: WhatsAppConversationDetail;
  messages: WhatsAppMessageRow[];
}

/**
 * Server-rendered conversation thread view. Displays all messages between the
 * business and a single customer in a familiar chat-bubble layout (customer
 * messages on the left, business/AI replies on the right).
 */
export function ConversationThread({ conversation, messages }: ConversationThreadProps) {
  return (
    <div className="max-w-4xl">
      {/* Header */}
      <Link
        href="/whatsapp"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.8} />
        Back to conversations
      </Link>

      <div className="mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0">
            <User size={22} strokeWidth={1.8} className="text-text-muted" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-[-0.5px] font-[family-name:var(--font-heading)] text-foreground truncate">
              {conversation.contact_name?.trim() || conversation.contact_phone}
            </h1>
            <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
              <Phone size={11} strokeWidth={1.8} />
              <span className="font-mono">{conversation.contact_phone}</span>
              <span className="mx-1.5 text-border">•</span>
              <span>
                {messages.length} message{messages.length === 1 ? "" : "s"}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <AiPauseToggle
              conversationId={conversation.id}
              initiallyPaused={conversation.ai_paused}
            />
            <ConvertToLeadButton conversationId={conversation.id} />
          </div>
        </div>
      </div>

      {/* Invisible — polls server-rendered data every 5s so new messages appear */}
      <AutoRefresh intervalMs={5000} />

      {/* Messages */}
      {messages.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-10 flex flex-col items-center text-center">
          <p className="text-sm text-text-muted">No messages yet in this conversation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      )}

      {/* Manual reply input */}
      <ManualReplyInput contactPhone={conversation.contact_phone} />
    </div>
  );
}

function MessageBubble({ message }: { message: WhatsAppMessageRow }) {
  const isOutbound = message.direction === "outbound";
  const timestamp = message.sent_at || message.created_at;

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] ${isOutbound ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOutbound
              ? "bg-primary text-white rounded-br-sm"
              : "bg-surface-elevated border border-border text-foreground rounded-bl-sm"
          }`}
        >
          {message.body ? (
            <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
          ) : (
            <p className="text-sm italic opacity-70">
              {message.message_type === "image"
                ? "📷 Image"
                : message.message_type === "video"
                ? "🎥 Video"
                : message.message_type === "audio"
                ? "🎙️ Audio"
                : message.message_type === "document"
                ? "📎 Document"
                : message.message_type === "sticker"
                ? "🎨 Sticker"
                : message.message_type === "location"
                ? "📍 Location"
                : "(media)"}
            </p>
          )}
        </div>
        <div
          className={`flex items-center gap-2 text-[10px] text-text-muted px-1 ${
            isOutbound ? "flex-row-reverse" : ""
          }`}
        >
          <span>{formatTime(timestamp)}</span>
          {message.ai_generated && (
            <Badge variant="processing" className="!px-1.5 !py-0 !text-[9px]">
              <Bot size={9} strokeWidth={2} />
              AI
            </Badge>
          )}
          {isOutbound && message.status !== "sent" && message.status !== "received" && (
            <span className="capitalize">{message.status}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
