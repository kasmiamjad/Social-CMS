"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, AlertCircle, Paperclip } from "lucide-react";

interface GroupReplyInputProps {
  groupConversationId: string;
}

interface SendError {
  code?: string;
  message: string;
}

/**
 * Minimal reply box for a group thread — text and image only, no voice
 * recording or quick-reply templates (those are 1:1-customer features).
 */
export function GroupReplyInput({ groupConversationId }: GroupReplyInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<SendError | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/whatsapp/groups/conversations/${groupConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError({ code: json.error?.code, message: json.error?.message ?? `Failed to send (HTTP ${res.status})` });
        return;
      }
      setText("");
      router.refresh();
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setSending(false);
    }
  }

  async function sendImage(file: File) {
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (text.trim()) formData.append("caption", text.trim());

      const res = await fetch(`/api/v1/whatsapp/groups/conversations/${groupConversationId}/messages`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError({ code: json.error?.code, message: json.error?.message ?? `Failed to send (HTTP ${res.status})` });
        return;
      }
      setText("");
      router.refresh();
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
    void sendImage(file);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="mt-6 pt-4 border-t border-border">
      {error && (
        <div className="mb-2 text-xs text-error flex items-start gap-1.5">
          <AlertCircle size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>
            {error.code && <span className="font-mono">[{error.code}]</span>} {error.message}
          </span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileSelected} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-border text-text-muted hover:text-foreground hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          title="Attach an image"
        >
          <Paperclip size={16} strokeWidth={1.8} />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={sending}
          maxLength={4096}
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none min-h-[42px]"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          title="Send (Enter)"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={1.8} />}
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-text-muted">Attachments: JPEG/PNG images only.</p>
    </div>
  );
}
