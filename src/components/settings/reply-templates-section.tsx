"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageSquareText, Plus, Trash2, Pencil, Check, X, AlertCircle, Camera } from "lucide-react";
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

async function uploadTemplateImage(templateId: string, file: File): Promise<TemplateRow | null> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/v1/reply-templates/${templateId}/image`, {
    method: "POST",
    body: formData,
  });
  const json = await res.json();
  return res.ok && json.success ? (json.data.template as TemplateRow) : null;
}

/** "Attach media" row + thumbnail preview, matching WhatsApp Business's own quick-reply editor. */
function AttachMediaRow({
  previewUrl,
  uploading,
  onAttach,
  onRemove,
}: {
  previewUrl: string | null;
  uploading: boolean;
  onAttach: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="w-full max-h-40 object-cover" />
      )}
      <button
        type="button"
        onClick={previewUrl ? onRemove : onAttach}
        disabled={uploading}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors disabled:opacity-50"
      >
        {previewUrl ? (
          <>
            <X size={15} strokeWidth={1.8} className="text-text-muted" />
            Remove media
          </>
        ) : (
          <>
            <Camera size={15} strokeWidth={1.8} className="text-text-muted" />
            {uploading ? "Uploading…" : "Attach media"}
          </>
        )}
      </button>
    </div>
  );
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
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const newImageInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShortcut, setEditShortcut] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editMediaUrl, setEditMediaUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editImageBusy, setEditImageBusy] = useState(false);
  const editImageInputRef = useRef<HTMLInputElement>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Clean up the local preview object URL when it's replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    };
  }, [newImagePreview]);

  function pickNewImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNewImageFile(file);
    setNewImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function clearNewImage() {
    setNewImageFile(null);
    setNewImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

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
      let created = json.data.template as TemplateRow;
      if (newImageFile) {
        const withImage = await uploadTemplateImage(created.id, newImageFile);
        if (withImage) created = withImage;
        else setError("Template created, but the image failed to upload.");
      }
      setTemplates((prev) => [...prev, created].sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
      setNewShortcut("");
      setNewMessage("");
      clearNewImage();
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
    setEditMediaUrl(t.media_url);
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

  async function handleEditImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editingId) return;

    setEditImageBusy(true);
    setError(null);
    const updated = await uploadTemplateImage(editingId, file);
    setEditImageBusy(false);
    if (!updated) {
      setError("Failed to upload image");
      return;
    }
    setEditMediaUrl(updated.media_url);
    setTemplates((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
  }

  async function handleRemoveEditImage() {
    if (!editingId) return;
    setEditImageBusy(true);
    try {
      const res = await fetch(`/api/v1/reply-templates/${editingId}/image`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        const updated = json.data.template as TemplateRow;
        setEditMediaUrl(updated.media_url);
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
      }
    } finally {
      setEditImageBusy(false);
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
              Business&apos;s own quick replies. Attach media and it&apos;s sent as a photo with the message as
              its caption.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* New template form */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Input
          id="new-template-shortcut"
          label="Shortcut"
          placeholder="e.g. thanks"
          value={newShortcut}
          onChange={(e) => {
            setNewShortcut(e.target.value);
            setError(null);
          }}
        />
        <Textarea
          id="new-template-message"
          label="Message"
          rows={3}
          placeholder="Full message this fills in…"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            setError(null);
          }}
        />
        <input
          ref={newImageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={pickNewImage}
        />
        <AttachMediaRow
          previewUrl={newImagePreview}
          uploading={false}
          onAttach={() => newImageInputRef.current?.click()}
          onRemove={clearNewImage}
        />
        <div className="flex justify-end">
          <Button onClick={() => void handleCreate()} loading={creating}>
            <Plus size={14} strokeWidth={1.8} />
            Add quick reply
          </Button>
        </div>
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
                <div className="space-y-3">
                  <Input
                    id={`edit-shortcut-${t.id}`}
                    label="Shortcut"
                    value={editShortcut}
                    onChange={(e) => setEditShortcut(e.target.value)}
                  />
                  <Textarea
                    id={`edit-message-${t.id}`}
                    label="Message"
                    rows={3}
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                  />
                  <input
                    ref={editImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleEditImageSelected}
                  />
                  <AttachMediaRow
                    previewUrl={editMediaUrl}
                    uploading={editImageBusy}
                    onAttach={() => editImageInputRef.current?.click()}
                    onRemove={() => void handleRemoveEditImage()}
                  />
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
                  {t.media_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.media_url}
                      alt=""
                      className="w-11 h-11 rounded-lg border border-border object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-primary">/{t.shortcut}</p>
                    <p className="text-sm text-text-muted mt-0.5 whitespace-pre-wrap">{t.message}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
