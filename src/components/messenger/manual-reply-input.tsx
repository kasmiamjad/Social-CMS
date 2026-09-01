"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { useReplyTemplates } from "@/hooks/use-reply-templates";
import { matchSlashQuery, filterTemplates, applyTemplate, type ReplyTemplate } from "@/lib/reply-templates";
import { TemplateSuggestions } from "@/components/whatsapp/template-suggestions";

interface ManualReplyInputProps {
  conversationId: string;
}

interface SendError {
  code?: string;
  message: string;
  details?: unknown;
}

/**
 * Client-side reply input box for a Messenger conversation. Sends via
 * /api/v1/messenger/conversations/:id/messages and refreshes the thread's
 * server data so the new outbound message appears.
 */
export function ManualReplyInput({ conversationId }: ManualReplyInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<SendError | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // "/" quick-reply autocomplete.
  const templates = useReplyTemplates();
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [pendingMediaUrl, setPendingMediaUrl] = useState<string | null>(null);
  const slashQuery = matchSlashQuery(text);
  const suggestions =
    slashQuery !== null && !suggestionsDismissed ? filterTemplates(templates, slashQuery) : [];

  function selectTemplate(t: ReplyTemplate) {
    if (slashQuery === null) return;
    setText(applyTemplate(text, slashQuery, t.message));
    setPendingMediaUrl(t.media_url);
    setSuggestionsDismissed(true);
    textareaRef.current?.focus();
  }

  // Auto-resize textarea as user types (up to a max height).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  async function handleSend() {
    const trimmed = text.trim();
    if ((!trimmed && !pendingMediaUrl) || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/messenger/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          pendingMediaUrl ? { body: trimmed || undefined, media_url: pendingMediaUrl } : { body: trimmed }
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

      setText("");
      setPendingMediaUrl(null);
      router.refresh();
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
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
    // Enter = send, Shift+Enter = newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="mt-6 pt-4 border-t border-border">
      {error && (
        <div className="mb-2 text-xs text-error">
          <div className="flex items-start gap-1.5">
            <AlertCircle size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
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

      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          {suggestions.length > 0 && (
            <TemplateSuggestions matches={suggestions} activeIndex={activeSuggestion} onSelect={selectTemplate} />
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
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSuggestionsDismissed(false);
              setActiveSuggestion(0);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a reply…  (Enter to send, / for quick replies)"
            rows={1}
            disabled={sending}
            maxLength={2000}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none min-h-[42px]"
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || (!text.trim() && !pendingMediaUrl)}
          className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-primary text-black hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          title="Send (Enter)"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={1.8} />}
        </button>
      </div>

      <p className="mt-1.5 text-[10px] text-text-muted">
        Free-form messages work only within Messenger's 24-hour standard messaging window.
      </p>
    </div>
  );
}
