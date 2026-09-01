"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Trash2, Loader2, ImageOff, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingPhotoKind } from "@/lib/booking-photo-constants";

export interface JobPhoto {
  id: string;
  url: string;
  kind: string;
  caption: string | null;
  created_at: string;
}

interface JobPhotosProps {
  bookingId: string;
  photos: JobPhoto[];
}

const KIND_TABS: { key: BookingPhotoKind; label: string }[] = [
  { key: "before", label: "Before" },
  { key: "after", label: "After" },
];

const SECTIONS: { key: string; label: string }[] = [
  { key: "before", label: "Before" },
  { key: "after", label: "After" },
  { key: "other", label: "Other" },
];

/**
 * Site-photo gallery + uploader for the job detail screen. The technician tags a
 * shot as Before/After, then either takes one from the phone camera or uploads
 * several from the gallery at once. Each photo can carry a caption, edited in the
 * lightbox. Uploads hit the tech-scoped photos API.
 */
export function JobPhotos({ bookingId, photos }: JobPhotosProps) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<BookingPhotoKind>("before");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<JobPhoto | null>(null);
  const [caption, setCaption] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);

  async function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        body.append("kind", kind);
        const res = await fetch(`/api/v1/tech/bookings/${bookingId}/photos`, {
          method: "POST",
          body,
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json?.error?.message ?? "Upload failed.");
          break;
        }
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  function openLightbox(photo: JobPhoto) {
    setLightbox(photo);
    setCaption(photo.caption ?? "");
  }

  async function saveCaption() {
    if (!lightbox) return;
    setSavingCaption(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tech/bookings/${bookingId}/photos/${lightbox.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: caption.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "Could not save caption.");
        return;
      }
      setLightbox(null);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSavingCaption(false);
    }
  }

  async function onDelete(photoId: string) {
    setDeleting(photoId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tech/bookings/${bookingId}/photos/${photoId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "Could not delete photo.");
        return;
      }
      setLightbox(null);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Kind selector */}
      <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface">
        {KIND_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setKind(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
              kind === t.key ? "bg-primary text-black" : "text-text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Capture (camera) + Upload (gallery, multi-select) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-black text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} strokeWidth={1.8} />}
          Take {kind} photo
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => galleryRef.current?.click()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-surface disabled:opacity-60"
        >
          <ImagePlus size={15} strokeWidth={1.8} />
          Upload
        </button>
        {/* Camera: single capture. Gallery: multiple files. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFilesPicked(e.target.files)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void onFilesPicked(e.target.files)}
        />
      </div>

      {error && <div className="rounded-lg bg-error/10 text-error text-xs px-3 py-2">{error}</div>}

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center text-text-muted">
          <ImageOff size={20} strokeWidth={1.6} />
          <p className="text-xs">No photos yet. Capture a before/after shot of the site.</p>
        </div>
      ) : (
        SECTIONS.map((section) => {
          const items = photos.filter((p) => p.kind === section.key);
          if (items.length === 0) return null;
          return (
            <div key={section.key}>
              <div className="text-[11px] uppercase tracking-wide text-text-muted mb-1.5">
                {section.label} · {items.length}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {items.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => openLightbox(photo)}
                    className="text-left"
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-surface border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption ?? `${section.label} photo`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {photo.caption && (
                      <p className="text-[10px] text-text-muted mt-1 line-clamp-2 leading-snug">
                        {photo.caption}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/90 hover:text-white"
            aria-label="Close"
          >
            <X size={24} strokeWidth={1.8} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.caption ?? "Site photo"}
            className="max-w-full max-h-[60vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Caption editor + actions */}
          <div className="w-full max-w-md mt-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={500}
              placeholder="Add a caption (e.g. kitchen tap, before)"
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={savingCaption || deleting === lightbox.id}
                onClick={saveCaption}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-black text-sm font-semibold disabled:opacity-60"
              >
                {savingCaption ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={1.8} />}
                Save caption
              </button>
              <button
                type="button"
                disabled={deleting === lightbox.id || savingCaption}
                onClick={() => void onDelete(lightbox.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-error/90 hover:bg-error text-white text-sm font-semibold disabled:opacity-60"
              >
                {deleting === lightbox.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} strokeWidth={1.8} />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
