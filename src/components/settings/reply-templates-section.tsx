"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageSquareText, Plus, Trash2, Pencil, Check, X, AlertCircle, ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface TemplateRow {
  id: string;
  shortcut: string;
  message: string;
  media_url: string | null;
}

/**
 * Manages the "/" quick-reply templates used by the WhatsApp reply boxes.
 * Typing "/shortcut" in a reply box suggests these and fills in the message.
 */
export function ReplyTemplatesSection() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newShortcut, setNewShortcut] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShortcut, setEditShortcut] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingImageTemplateId = useRef<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/reply-templates");
      const json = await res.json();
      if (json.success) setTemplates(json.data.templates as TemplateRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  async function handleCreate() {
    const shortcut = newShortcut.trim().toLowerCase();
    const message = newMessage.trim();
    if (!shortcut || !message) {
      setError("Shortcut and message are both required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/reply-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortcut, message }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to create template");
        return;
      }
      setTemplates((prev) => [...prev, json.data.template as TemplateRow].sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
      setNewShortcut("");
      setNewMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(t: TemplateRow) {
    setEditingId(t.id);
    setEditShortcut(t.shortcut);
    setEditMessage(t.message);
    setError(null);
  }

  async function handleSaveEdit(id: string) {
    const shortcut = editShortcut.trim().toLowerCase();
    const message = editMessage.trim();
    if (!shortcut || !message) {
      setError("Shortcut and message are both required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reply-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortcut, message }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to save template");
        return;
      }
      setTemplates((prev) =>
        prev
          .map((t) => (t.id === id ? (json.data.template as TemplateRow) : t))
          .sort((a, b) => a.shortcut.localeCompare(b.shortcut))
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/reply-templates/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to delete template");
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function triggerImageUpload(templateId: string) {
    pendingImageTemplateId.current = templateId;
    setError(null);
    imageInputRef.current?.click();
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const templateId = pendingImageTemplateId.current;
    e.target.value = "";
    if (!file || !templateId) return;

    setUploadingImageId(templateId);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/reply-templates/${templateId}/image`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to upload image");
        return;
      }
      setTemplates((prev) => prev.map((t) => (t.id === templateId ? (json.data.template as TemplateRow) : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setUploadingImageId(null);
      pendingImageTemplateId.current = null;
    }
  }

  async function handleRemoveImage(templateId: string) {
    setUploadingImageId(templateId);
    try {
      const res = await fetch(`/api/v1/reply-templates/${templateId}/image`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        setTemplates((prev) => prev.map((t) => (t.id === templateId ? (json.data.template as TemplateRow) : t)));
      }
    } finally {
      setUploadingImageId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
            <MessageSquareText size={20} strokeWidth={1.8} className="text-foreground" />
          </div>
          <div>
            <CardTitle>Quick Replies</CardTitle>
            <CardDescription>
              Type &ldquo;/shortcut&rdquo; in a WhatsApp reply box to fill in the full message — same as WhatsApp
              Business&apos;s own quick replies. Add an image to a template and it&apos;s sent as a photo with
              the message as its caption.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleImageSelected}
      />

      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2 items-start">
        <Input
          id="new-template-shortcut"
          label=""
          placeholder="shortcut"
          value={newShortcut}
          onChange={(e) => {
            setNewShortcut(e.target.value);
            setError(null);
          }}
        />
        <Textarea
          id="new-template-message"
          label=""
          rows={1}
          placeholder="Full message this fills in…"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            setError(null);
          }}
        />
        <Button onClick={() => void handleCreate()} loading={creating} className="sm:mt-0">
          <Plus size={14} strokeWidth={1.8} />
          Add
        </Button>
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-error">
          <AlertCircle size={13} strokeWidth={1.8} />
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-text-muted">No quick replies yet.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-border px-4 py-3">
              {editingId === t.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                    <Input
                      id={`edit-shortcut-${t.id}`}
                      label=""
                      value={editShortcut}
                      onChange={(e) => setEditShortcut(e.target.value)}
                    />
                    <Textarea
                      id={`edit-message-${t.id}`}
                      label=""
                      rows={2}
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="secondary" onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs">
                      <X size={13} strokeWidth={1.8} />
                      Cancel
                    </Button>
                    <Button onClick={() => void handleSaveEdit(t.id)} loading={saving} className="px-3 py-1.5 text-xs">
                      <Check size={13} strokeWidth={1.8} />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  {t.media_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.media_url}
                      alt=""
                      className="w-11 h-11 rounded-lg border border-border object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg border border-dashed border-border flex items-center justify-center shrink-0">
                      <ImageIcon size={16} strokeWidth={1.8} className="text-text-muted" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-primary">/{t.shortcut}</p>
                    <p className="text-sm text-text-muted mt-0.5 whitespace-pre-wrap">{t.message}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      onClick={() => (t.media_url ? void handleRemoveImage(t.id) : triggerImageUpload(t.id))}
                      loading={uploadingImageId === t.id}
                      className="text-text-muted hover:text-foreground px-2 py-1.5"
                      title={t.media_url ? "Remove image" : "Attach image"}
                    >
                      {t.media_url ? <X size={14} strokeWidth={1.8} /> : <Upload size={14} strokeWidth={1.8} />}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => startEdit(t)}
                      className="text-text-muted hover:text-foreground px-2 py-1.5"
                    >
                      <Pencil size={14} strokeWidth={1.8} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void handleDelete(t.id)}
                      loading={deletingId === t.id}
                      className="text-text-muted hover:text-error px-2 py-1.5"
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
