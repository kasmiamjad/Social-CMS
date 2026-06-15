"use client";

import { useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, Upload, X, CheckCircle } from "lucide-react";

const PRODUCT_SLOTS = [
  { slug: "dispenser",      label: "RO Water Dispenser (Hot/Cold)", price: "SAR 499" },
  { slug: "ro_699",         label: "7-Stage RO Purifier",           price: "SAR 699" },
  { slug: "ro_uv_999",      label: "7-Stage RO Purifier + UV",      price: "SAR 999" },
  { slug: "smart_ro_1199",  label: "6-Stage Smart RO",              price: "SAR 1,199" },
  { slug: "smart_ro_1299",  label: "7-Stage Smart RO",              price: "SAR 1,299" },
] as const;

type ProductSlug = (typeof PRODUCT_SLOTS)[number]["slug"];

interface ProductImagesFormProps {
  initialImages: Record<string, string>;
}

export function ProductImagesForm({ initialImages }: ProductImagesFormProps) {
  const [images, setImages] = useState<Record<string, string>>(initialImages);
  const [uploading, setUploading] = useState<ProductSlug | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ProductSlug, string>>>({});
  const [success, setSuccess] = useState<ProductSlug | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlug = useRef<ProductSlug | null>(null);

  function triggerUpload(slug: ProductSlug) {
    pendingSlug.current = slug;
    setErrors((prev) => ({ ...prev, [slug]: undefined }));
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const slug = pendingSlug.current;
    if (!file || !slug) return;

    // Reset input so the same file can be re-selected if needed
    e.target.value = "";

    setUploading(slug);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("slug", slug);

    try {
      const res = await fetch("/api/v1/whatsapp/product-images", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrors((prev) => ({
          ...prev,
          [slug]: json.error?.message ?? "Upload failed",
        }));
      } else {
        setImages((prev) => ({ ...prev, [slug]: json.data.url }));
        setSuccess(slug);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      setErrors((prev) => ({ ...prev, [slug]: "Network error — please try again" }));
    } finally {
      setUploading(null);
      pendingSlug.current = null;
    }
  }

  async function handleRemove(slug: ProductSlug) {
    try {
      const res = await fetch(`/api/v1/whatsapp/product-images?slug=${slug}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setImages((prev) => {
          const next = { ...prev };
          delete next[slug];
          return next;
        });
      }
    } catch {
      // Silent — image still shows, user can retry
    }
  }

  const uploadedCount = PRODUCT_SLOTS.filter((p) => images[p.slug]).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
            <ImageIcon size={20} strokeWidth={1.8} className="text-foreground" />
          </div>
          <div>
            <CardTitle>Product Images</CardTitle>
            <CardDescription>
              Bot sends these images automatically when a customer asks for photos.{" "}
              <span className="text-foreground font-medium">{uploadedCount}/5 uploaded</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Hidden file input — shared by all 5 slots */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="space-y-2">
        {PRODUCT_SLOTS.map((product) => {
          const url = images[product.slug];
          const isUploading = uploading === product.slug;
          const isSuccess = success === product.slug;
          const error = errors[product.slug];

          return (
            <div
              key={product.slug}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              {/* Thumbnail */}
              <div className="w-11 h-11 rounded-lg border border-border bg-surface flex items-center justify-center flex-shrink-0 overflow-hidden">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={product.label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon size={18} strokeWidth={1.8} className="text-text-muted" />
                )}
              </div>

              {/* Product info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {product.label}
                </div>
                <div className="text-xs text-text-muted">{product.price}</div>
                {error && (
                  <div className="text-xs text-error mt-0.5">{error}</div>
                )}
                {isSuccess && (
                  <div className="flex items-center gap-1 text-xs text-success mt-0.5">
                    <CheckCircle size={11} strokeWidth={1.8} />
                    Uploaded
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {url && !isUploading && (
                  <button
                    onClick={() => handleRemove(product.slug)}
                    title="Remove image"
                    className="p-1 rounded hover:bg-surface text-text-muted hover:text-error transition-colors"
                  >
                    <X size={14} strokeWidth={1.8} />
                  </button>
                )}
                <Button
                  size="sm"
                  variant={url ? "secondary" : "primary"}
                  loading={isUploading}
                  onClick={() => triggerUpload(product.slug)}
                >
                  <Upload size={13} strokeWidth={1.8} className="mr-1.5" />
                  {url ? "Change" : "Upload"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-muted mt-3">
        PNG, JPG or WebP · max 5 MB per image. Images are served from Supabase Storage.
      </p>
    </Card>
  );
}
