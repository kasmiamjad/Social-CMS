import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { AutoRefresh } from "@/components/whatsapp/auto-refresh";
import { ScrollToBottomOnMount } from "@/components/whatsapp/scroll-to-bottom-on-mount";
import { VoiceNotePlayer } from "@/components/whatsapp/voice-note-player";
import { GroupReplyInput } from "./group-reply-input";

export interface WhatsAppGroupConversationDetail {
  id: string;
  group_jid: string;
  group_name: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface WhatsAppGroupMessageRow {
  id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  sender_name: string | null;
  body: string | null;
  media_url: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
}

interface GroupConversationThreadProps {
  conversation: WhatsAppGroupConversationDetail;
  messages: WhatsAppGroupMessageRow[];
}

/**
 * Read + reply view for a WhatsApp group thread. Deliberately has no AI
 * pause toggle or lead-conversion action — groups don't go through that
 * pipeline at all.
 */
export function GroupConversationThread({ conversation, messages }: GroupConversationThreadProps) {
  return (
    <div className="max-w-4xl">
      <Link
        href="/whatsapp-groups"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.8} />
        Back to groups
      </Link>

      <div className="mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Users size={20} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-[-0.5px] font-[family-name:var(--font-heading)] text-foreground truncate">
              {conversation.group_name?.trim() || "Unnamed group"}
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <AutoRefresh intervalMs={5000} />
      <ScrollToBottomOnMount />

      {messages.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-10 flex flex-col items-center text-center">
          <p className="text-sm text-text-muted">No messages yet in this group.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <GroupMessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      )}

      <GroupReplyInput groupConversationId={conversation.id} />
    </div>
  );
}

function GroupMessageBubble({ message }: { message: WhatsAppGroupMessageRow }) {
  const isOutbound = message.direction === "outbound";
  const timestamp = message.sent_at || message.created_at;

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] ${isOutbound ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl overflow-hidden ${
            message.message_type === "audio" && message.media_url
              ? "px-2.5 py-2"
              : message.media_url
                ? "p-1.5"
                : "px-4 py-2.5"
          } ${
            isOutbound
              ? "bg-primary text-white rounded-br-sm"
              : "bg-surface-elevated border border-border text-foreground rounded-bl-sm"
          }`}
        >
          {!isOutbound && message.sender_name?.trim() && (
            <p className="text-[11px] font-semibold text-primary mb-0.5 px-0.5">{message.sender_name}</p>
          )}
          <GroupMediaContent message={message} />
          {message.body &&
            !["sticker", "audio", "audio_file", "document", "location"].includes(message.message_type) && (
              <p className="text-sm whitespace-pre-wrap break-words px-0.5 mt-1">{message.body}</p>
            )}
        </div>
        <div className={`flex items-center gap-2 text-[10px] text-text-muted px-1 ${isOutbound ? "flex-row-reverse" : ""}`}>
          <span>{formatTime(timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function GroupMediaContent({ message }: { message: WhatsAppGroupMessageRow }) {
  const { message_type, media_url, body } = message;

  if (media_url) {
    switch (message_type) {
      case "image":
      case "sticker":
        return (
          <a href={media_url} target="_blank" rel="noopener noreferrer" title="Open full size / download">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media_url}
              alt={body || message_type}
              className="max-w-full max-h-72 rounded-xl object-contain cursor-zoom-in"
            />
          </a>
        );
      case "video":
        return (
          <video controls className="max-w-full max-h-72 rounded-xl">
            <source src={media_url} />
          </video>
        );
      case "audio":
        return (
          <VoiceNotePlayer
            src={media_url}
            seed={message.id}
            variant={message.direction === "outbound" ? "outbound" : "inbound"}
            contactName={message.sender_name}
          />
        );
      case "audio_file":
        return <audio controls src={media_url} className="w-64 max-w-full" />;
      case "document":
        return (
          <a
            href={media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2 py-1.5 text-sm underline underline-offset-2"
          >
            📎 {body?.replace(/^📎 /, "") || "Document"}
          </a>
        );
    }
  }

  if (["image", "video", "audio", "audio_file", "document", "sticker"].includes(message_type)) {
    return <p className="text-sm italic opacity-70">{body || "(media)"}</p>;
  }
  if (message_type === "location") {
    return <p className="text-sm italic opacity-70">{body || "📍 Location"}</p>;
  }
  return null;
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
