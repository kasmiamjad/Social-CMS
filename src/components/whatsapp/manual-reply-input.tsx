"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, AlertCircle, Paperclip, Mic, Square, Trash2 } from "lucide-react";
import { useReplyTemplates } from "@/hooks/use-reply-templates";
import { matchSlashQuery, filterTemplates, applyTemplate, type ReplyTemplate } from "@/lib/reply-templates";
import { TemplateSuggestions } from "./template-suggestions";

const ATTACHMENT_ACCEPT = "image/jpeg,image/png,audio/*";

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

interface ManualReplyInputProps {
  contactPhone: string;
}

interface SendError {
  code?: string;
  message: string;
  details?: unknown;
}

/**
 * Client-side reply input box. Sends a free-form WhatsApp text message via
 * /api/v1/whatsapp/send and then refreshes the thread server data so the new
 * outbound message appears.
 *
 * NOTE: WhatsApp only allows free-form messages within the 24-hour customer
 * service window. Outside that window, only pre-approved templates work and
 * this endpoint will return an error from Meta.
 */
export function ManualReplyInput({ contactPhone }: ManualReplyInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<SendError | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // "/" quick-reply autocomplete.
  const templates = useReplyTemplates();
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const slashQuery = matchSlashQuery(text);
  const suggestions =
    slashQuery !== null && !suggestionsDismissed ? filterTemplates(templates, slashQuery) : [];

  function selectTemplate(t: ReplyTemplate) {
    if (slashQuery === null) return;
    setText(applyTemplate(text, slashQuery, t.message));
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
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: contactPhone,
          body: trimmed,
        }),
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
      // Re-fetch server data so the new outbound message appears in the thread.
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

  async function sendMediaFile(file: File) {
    setSending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("to", contactPhone);
      formData.append("file", file);
      if (file.type.startsWith("image/") && text.trim()) {
        formData.append("caption", text.trim());
      }

      const res = await fetch("/api/v1/whatsapp/send-media", {
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
    e.target.value = ""; // allow re-selecting the same file later
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

      {recording ? (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-error/40 bg-error/5">
          <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse shrink-0" />
          <span className="text-sm text-foreground font-mono">{formatSeconds(recordSeconds)}</span>
          <span className="text-xs text-text-muted flex-1">Recording…</span>
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white hover:bg-primary-hover transition-all shrink-0"
            title="Stop recording"
          >
            <Square size={14} strokeWidth={1.8} fill="currentColor" />
          </button>
        </div>
      ) : recordedBlob ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface">
          {recordedUrl && <audio controls src={recordedUrl} className="h-9 flex-1" />}
          <button
            type="button"
            onClick={discardRecording}
            disabled={sending}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:text-error hover:bg-error/10 disabled:opacity-40 transition-all shrink-0"
            title="Discard"
          >
            <Trash2 size={15} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={sendRecording}
            disabled={sending}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition-all shrink-0"
            title="Send voice note"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} strokeWidth={1.8} />}
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
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
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-border text-text-muted hover:text-foreground hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
            title="Attach image or voice clip"
          >
            <Paperclip size={16} strokeWidth={1.8} />
          </button>
          <div className="relative flex-1">
            {suggestions.length > 0 && (
              <TemplateSuggestions
                matches={suggestions}
                activeIndex={activeSuggestion}
                onSelect={selectTemplate}
              />
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
              placeholder="Type a reply… (Enter to send, Shift+Enter for new line, / for quick replies)"
              rows={1}
              disabled={sending}
              maxLength={4096}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none min-h-[42px]"
            />
          </div>
          {text.trim() ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              title="Send (Enter)"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={1.8} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={sending}
              className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-border text-text-muted hover:text-foreground hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              title="Record a voice note"
            >
              <Mic size={16} strokeWidth={1.8} />
            </button>
          )}
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-text-muted">
        Free-form messages work only within the 24-hour customer service window.
        Outside that window, only pre-approved templates will deliver.
        Attachments: JPEG/PNG images or any audio file — max 16MB.
      </p>
    </div>
  );
}
