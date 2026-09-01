"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Send, Bot, MessageCircle, Loader2, AlertCircle, Paperclip, Mic, Square, Trash2 } from "lucide-react";
import { useReplyTemplates } from "@/hooks/use-reply-templates";
import { matchSlashQuery, filterTemplates, applyTemplate, type ReplyTemplate } from "@/lib/reply-templates";
import { TemplateSuggestions } from "@/components/whatsapp/template-suggestions";
import { VoiceNotePlayer } from "@/components/whatsapp/voice-note-player";

const ATTACHMENT_ACCEPT = "image/jpeg,image/png,application/pdf,audio/*";

/** Picks the best audio mimeType this browser's MediaRecorder actually supports. */
function pickRecorderMimeType(): string {
  const candidates = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface ActiveChat {
  channel: "whatsapp" | "messenger" | "instagram";
  conversationId: string;
  name: string;
  /** The lead this conversation belongs to, and its current triage status — used to auto-mark it "read" on open. */
  leadId?: string;
  callStatus?: string | null;
}

interface SendError {
  code?: string;
  message: string;
  details?: unknown;
}

interface ChatMessage {
  id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  body: string | null;
  media_url?: string | null;
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
  const [error, setError] = useState<SendError | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // "/" quick-reply autocomplete — all channels.
  const templates = useReplyTemplates();
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [pendingMediaUrl, setPendingMediaUrl] = useState<string | null>(null);
  const slashQuery = matchSlashQuery(reply);
  const suggestions =
    slashQuery !== null && !suggestionsDismissed ? filterTemplates(templates, slashQuery) : [];

  function selectTemplate(t: ReplyTemplate) {
    if (slashQuery === null) return;
    setReply(applyTemplate(reply, slashQuery, t.message));
    setPendingMediaUrl(t.media_url);
    setSuggestionsDismissed(true);
    textareaRef.current?.focus();
  }

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

  // Opening the chat counts as reading it — flip the lead's triage status once.
  useEffect(() => {
    if (chat.callStatus !== "unread" || !chat.leadId) return;
    void fetch(`/api/v1/leads/${chat.leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call_status: "read" }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.leadId]);

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
    if ((!text && !pendingMediaUrl) || sending) return;
    setSending(true);
    setError(null);
    try {
      if (pendingMediaUrl && chat.channel === "whatsapp") {
        if (!contact) {
          setError({ message: "Contact not loaded yet — try again in a moment." });
          return;
        }
        const res = await fetch("/api/v1/whatsapp/send-image-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: contact, media_url: pendingMediaUrl, caption: text || undefined }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError({
            code: json.error?.code,
            message: json.error?.message ?? `Failed to send (HTTP ${res.status})`,
            details: json.error?.details,
          });
          return;
        }
        setReply("");
        setPendingMediaUrl(null);
        void load();
        return;
      }

      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          pendingMediaUrl ? { body: text || undefined, media_url: pendingMediaUrl } : { body: text }
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError({
          code: json.error?.code,
          message: json.error?.message ?? `Failed to send (HTTP ${res.status})`,
          details: json.error?.details,
        });
        return;
      }
      setReply("");
      setPendingMediaUrl(null);
      if (json.data.message) setMessages((prev) => [...prev, json.data.message]);
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setSending(false);
    }
  }

  async function sendMediaFile(file: File) {
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if ((file.type.startsWith("image/") || file.type === "application/pdf") && reply.trim()) {
        formData.append("caption", reply.trim());
      }

      const res = await fetch(`/api/v1/whatsapp/conversations/${chat.conversationId}/media`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError({
          code: json.error?.code,
          message: json.error?.message ?? `Failed to send (HTTP ${res.status})`,
          details: json.error?.details,
        });
        return;
      }
      setReply("");
      if (json.data.message) setMessages((prev) => [...prev, json.data.message]);
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setSending(false);
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || sending) return;
    void sendMediaFile(file);
  }

  // ── Voice recording ──────────────────────────────────────────────────────

  const clearRecordingTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        stopStream();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setError({
        message:
          "Couldn't access your microphone. Check the browser's mic permission for this site and try again.",
      });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    clearRecordingTimer();
  }

  function discardRecording() {
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordSeconds(0);
  }

  async function sendRecording() {
    if (!recordedBlob) return;
    const ext = recordedBlob.type.includes("ogg") ? "ogg" : recordedBlob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([recordedBlob], `voice-note.${ext}`, { type: recordedBlob.type });
    discardRecording();
    await sendMediaFile(file);
  }

  // Clean up mic stream / timer / object URL if the component unmounts mid-flow.
  useEffect(() => {
    return () => {
      clearRecordingTimer();
      stopStream();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            messages.map((m) => <Bubble key={m.id} message={m} contactName={chat.name} />)
          )}
        </div>

        {/* Reply */}
        <div className="border-t border-border p-3 shrink-0">
          {error && (
            <div className="mb-2 text-xs text-error">
              <div className="flex items-start gap-1.5">
                <AlertCircle size={13} strokeWidth={1.8} className="mt-0.5 shrink-0" />
                <span>
                  {error.code && <span className="font-mono">[{error.code}]</span>} {error.message}
                </span>
              </div>
              {error.details !== undefined && (
                <details className="mt-1 ml-[18px]">
                  <summary className="cursor-pointer text-text-muted">Show raw error details</summary>
                  <pre className="mt-1 max-w-full overflow-x-auto rounded-md bg-surface border border-border p-2 text-[10px] text-text-muted whitespace-pre-wrap break-words">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
          {recording ? (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-error/40 bg-error/5">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse shrink-0" />
              <span className="text-sm text-foreground font-mono">{formatSeconds(recordSeconds)}</span>
              <span className="text-xs text-text-muted flex-1">Recording…</span>
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-black hover:bg-primary-hover transition-all shrink-0"
                title="Stop recording"
              >
                <Square size={13} strokeWidth={1.8} fill="currentColor" />
              </button>
            </div>
          ) : recordedBlob ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-surface">
              {recordedUrl && <audio controls src={recordedUrl} className="h-8 flex-1" />}
              <button
                type="button"
                onClick={discardRecording}
                disabled={sending}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-error hover:bg-error/10 disabled:opacity-40 transition-all shrink-0"
                title="Discard"
              >
                <Trash2 size={14} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={sendRecording}
                disabled={sending}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-black hover:bg-primary-hover disabled:opacity-40 transition-all shrink-0"
                title="Send voice note"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={1.8} />}
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              {chat.channel === "whatsapp" && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    onChange={handleFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-text-muted hover:text-foreground hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                    title="Attach image, PDF, or voice clip"
                  >
                    <Paperclip size={15} strokeWidth={1.8} />
                  </button>
                </>
              )}
              <div className="relative flex-1">
                {suggestions.length > 0 && (
                  <TemplateSuggestions
                    matches={suggestions}
                    activeIndex={activeSuggestion}
                    onSelect={selectTemplate}
                  />
                )}
                {pendingMediaUrl && (
                  <div className="flex items-center gap-2 mb-1.5 px-2 py-1.5 rounded-lg border border-border bg-surface w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pendingMediaUrl} alt="" className="w-8 h-8 rounded object-cover" />
                    <span className="text-xs text-text-muted">Image from quick reply</span>
                    <button
                      type="button"
                      onClick={() => setPendingMediaUrl(null)}
                      className="text-text-muted hover:text-error transition-colors"
                      aria-label="Remove attached image"
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={reply}
                  onChange={(e) => {
                    setReply(e.target.value);
                    setSuggestionsDismissed(false);
                    setActiveSuggestion(0);
                  }}
                  onKeyDown={(e) => {
                    if (suggestions.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveSuggestion((i) => (i + 1) % suggestions.length);
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveSuggestion((i) => (i - 1 + suggestions.length) % suggestions.length);
                        return;
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        selectTemplate(suggestions[activeSuggestion] ?? suggestions[0]);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setSuggestionsDismissed(true);
                        return;
                      }
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={2}
                  placeholder="Type a reply…  (Enter to send, / for quick replies)"
                  className="w-full resize-none px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {chat.channel === "whatsapp" && !reply.trim() && !pendingMediaUrl ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={sending}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-text-muted hover:text-foreground hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 !px-0"
                  title="Record a voice note"
                >
                  <Mic size={15} strokeWidth={1.8} />
                </button>
              ) : (
                <Button
                  onClick={handleSend}
                  loading={sending}
                  disabled={!reply.trim() && !pendingMediaUrl}
                  className="!px-3"
                >
                  <Send size={15} strokeWidth={1.8} />
                </Button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Bubble({ message, contactName }: { message: ChatMessage; contactName: string }) {
  const isOutbound = message.direction === "outbound";
  const timestamp = message.sent_at || message.created_at;
  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] flex flex-col gap-1 ${isOutbound ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl overflow-hidden ${
            message.message_type === "audio" && message.media_url
              ? "px-2.5 py-2"
              : message.media_url
                ? "p-1.5"
                : "px-3.5 py-2"
          } ${
            isOutbound
              ? "bg-primary text-black rounded-br-sm"
              : "bg-surface border border-border text-foreground rounded-bl-sm"
          }`}
        >
          <ChatMediaContent message={message} contactName={contactName} />
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

const MEDIA_TYPES = ["image", "sticker", "video", "audio", "audio_file", "document"];

/** Same media-rendering logic as the main WhatsApp thread, adapted for this drawer's ChatMessage shape. */
function ChatMediaContent({ message, contactName }: { message: ChatMessage; contactName: string }) {
  const { id, message_type, media_url, body, direction } = message;

  if (media_url) {
    switch (message_type) {
      case "image":
        return (
          <>
            <a href={media_url} target="_blank" rel="noopener noreferrer" title="Open full size / download">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media_url}
                alt={body || message_type}
                className="max-w-full max-h-64 rounded-xl object-contain cursor-zoom-in"
              />
            </a>
            {body && <p className="text-sm whitespace-pre-wrap break-words mt-1.5 px-1">{body}</p>}
          </>
        );
      case "sticker":
        return (
          <a href={media_url} target="_blank" rel="noopener noreferrer" title="Open full size / download">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media_url}
              alt={message_type}
              className="max-w-full max-h-64 rounded-xl object-contain cursor-zoom-in"
            />
          </a>
        );
      case "video":
        return (
          <>
            <video controls className="max-w-full max-h-64 rounded-xl">
              <source src={media_url} />
            </video>
            {body && <p className="text-sm whitespace-pre-wrap break-words mt-1.5 px-1">{body}</p>}
          </>
        );
      case "audio":
        return (
          <VoiceNotePlayer
            src={media_url}
            seed={id}
            variant={direction === "outbound" ? "outbound" : "inbound"}
            contactName={contactName}
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

  if (MEDIA_TYPES.includes(message_type)) {
    return <p className="text-sm italic opacity-70">{body || `(${message_type})`}</p>;
  }

  return message.body ? (
    <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
  ) : (
    <p className="text-sm italic opacity-70">({message_type})</p>
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
