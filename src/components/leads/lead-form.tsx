"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_MODEL_OPTIONS } from "@/lib/products";
import { TEAM_MEMBERS, TEAM_MEMBER_COLORS, type TeamMember } from "@/lib/team";
import { CALL_STATUS_OPTIONS } from "@/lib/lead-status";
import {
  AlertCircle,
  CheckCircle,
  User,
  Phone,
  Mail,
  Building2,
  Package,
  MapPin,
  Globe2,
  Loader2,
  Trash2,
  UserCheck,
  Plus,
} from "lucide-react";

export interface Lead {
  id?: string;
  serial_no?: number;
  client_code?: string | null;
  qr_code?: string | null;
  client_name: string;
  client_phone?: string | null;
  client_email?: string | null;
  client_business_type?: string | null;
  product_qty?: number;
  product_model?: string | null;
  products?: { qty: number; model: string | null }[] | null;
  lead_date?: string | null;
  installation_date?: string | null;
  next_service_date?: string | null;
  scope?: string | null;
  installed_by?: string | null;
  location_address?: string | null;
  location_url?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  city?: string | null;
  assigned_to?: string | null;
  call_status?: string | null;
  status?: string;
  source?: string;
  whatsapp_conversation_id?: string | null;
  messenger_conversation_id?: string | null;
  booking_token?: string | null;
  remarks?: string | null;
  internal_notes?: string | null;
}

const CITY_OPTIONS = ["Riyadh", "Jeddah", "Dammam"];

const BUSINESS_TYPE_OPTIONS = [
  "Coffee shop",
  "Restaurant",
  "Office",
  "Accommodation",
  "Medical Center",
  "Retail Store",
  "School",
  "Hotel",
  "Home / Residential",
  "Factory",
  "Other",
];

interface LeadFormProps {
  initialLead: Lead | null;   // null for create, populated for edit
  mode: "create" | "edit";
}

/**
 * Full lead create/edit form. Mirrors the columns from the SA'DA H2O Excel
 * sheet plus location lat/lng for map integration later.
 */
export function LeadForm({ initialLead, mode }: LeadFormProps) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead>(() => {
    const base: Lead =
      initialLead ?? {
        client_name: "",
        product_qty: 1,
        status: "new",
        source: "manual",
      };
    // Old leads only have the single product_qty/product_model pair — seed
    // the row list from those so they show up as one editable row.
    if (!base.products || base.products.length === 0) {
      return {
        ...base,
        products: [{ qty: base.product_qty ?? 1, model: base.product_model ?? null }],
      };
    }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatusMsg] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  function update<K extends keyof Lead>(key: K, value: Lead[K]) {
    setLead((prev) => ({ ...prev, [key]: value }));
    if (status) setStatusMsg(null);
  }

  function updateProductRow<K extends "qty" | "model">(
    index: number,
    field: K,
    value: { qty: number; model: string | null }[K]
  ) {
    setLead((prev) => {
      const rows = [...(prev.products ?? [])];
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, products: rows };
    });
    if (status) setStatusMsg(null);
  }

  function addProductRow() {
    setLead((prev) => ({ ...prev, products: [...(prev.products ?? []), { qty: 1, model: null }] }));
  }

  function removeProductRow(index: number) {
    setLead((prev) => ({ ...prev, products: (prev.products ?? []).filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!lead.client_name?.trim()) {
      setStatusMsg({ type: "error", message: "Client name is required." });
      return;
    }
    setSaving(true);
    setStatusMsg(null);

    try {
      const url =
        mode === "create"
          ? "/api/v1/leads"
          : `/api/v1/leads/${initialLead!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      // Booking creation still reads the flat product_qty/product_model, so
      // keep them in sync with the first row — the rest of the pipeline
      // needs no changes.
      const firstRow = lead.products?.[0];
      const payload = {
        ...lead,
        product_qty: firstRow?.qty ?? lead.product_qty ?? 1,
        product_model: firstRow?.model ?? lead.product_model ?? null,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setStatusMsg({ type: "error", message: json.error?.message ?? "Save failed" });
        return;
      }
      setStatusMsg({ type: "success", message: "Lead saved." });
      if (mode === "create") {
        router.push(`/leads/${json.data.lead.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setStatusMsg({
        type: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initialLead?.id) return;
    if (!confirm(`Delete lead "${lead.client_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/leads/${initialLead.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setStatusMsg({ type: "error", message: json.error?.message ?? "Delete failed" });
        setDeleting(false);
        return;
      }
      router.push("/leads");
    } catch (err) {
      setStatusMsg({
        type: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
      setDeleting(false);
    }
  }

  // Opening an unread lead claims it: the API auto-assigns it to whoever is
  // actually signed in and flips it to read.
  useEffect(() => {
    if (mode !== "edit" || !initialLead?.id || initialLead.call_status !== "unread") return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/leads/${initialLead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ call_status: "read" }),
        });
        const json = await res.json();
        if (!cancelled && res.ok && json.success) {
          setLead((prev) => ({
            ...prev,
            assigned_to: json.data.lead.assigned_to,
            call_status: "read",
          }));
        }
      } catch {
        // Best-effort — leave it unread if this fails, no user-facing error needed.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, initialLead?.id, initialLead?.call_status]);

  const assignedToField = (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">Assigned to</label>
      <div className="relative">
        <UserCheck
          size={16}
          strokeWidth={1.8}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <select
          value={lead.assigned_to ?? ""}
          onChange={(e) => update("assigned_to", e.target.value || null)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">(unassigned)</option>
          {lead.assigned_to && !TEAM_MEMBERS.includes(lead.assigned_to as TeamMember) && (
            <option value={lead.assigned_to}>{lead.assigned_to}</option>
          )}
          {TEAM_MEMBERS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {lead.assigned_to && (
        <Badge className={`mt-1.5 ${TEAM_MEMBER_COLORS[lead.assigned_to] ?? "bg-surface text-text-muted"}`}>
          {lead.assigned_to}
        </Badge>
      )}
    </div>
  );

  const cityField = (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
      <div className="relative">
        <MapPin
          size={16}
          strokeWidth={1.8}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <select
          value={lead.city ?? ""}
          onChange={(e) => update("city", e.target.value || null)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">(select)</option>
          {lead.city && !CITY_OPTIONS.includes(lead.city) && (
            <option value={lead.city}>{lead.city}</option>
          )}
          {CITY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>
                {mode === "create"
                  ? "New Lead"
                  : `Lead #${lead.serial_no ?? ""} — ${lead.client_name}`}
              </CardTitle>
              <CardDescription>
                {mode === "create"
                  ? "Capture a new customer enquiry."
                  : `Source: ${lead.source ?? "manual"}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {lead.source === "whatsapp_ai" && lead.whatsapp_conversation_id && (
                <Badge variant="processing">From WhatsApp</Badge>
              )}
              <select
                value={lead.call_status ?? ""}
                onChange={(e) => update("call_status", e.target.value || null)}
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Status: (unset)</option>
                {CALL_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    Status: {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Section cards in a masonry-style 2-column flow so short cards don't
          leave big gaps (packs tightly by height). */}
      <div className="columns-1 xl:columns-2 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid">
      {/* Customer info */}
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="client_name"
              label="Client name *"
              icon={User}
              value={lead.client_name ?? ""}
              onChange={(e) => update("client_name", e.target.value)}
            />
            <Input
              id="client_phone"
              label="Phone"
              icon={Phone}
              placeholder="+966XXXXXXXXX"
              value={lead.client_phone ?? ""}
              onChange={(e) => update("client_phone", e.target.value)}
            />
            <Input
              id="client_email"
              label="Email"
              icon={Mail}
              type="email"
              value={lead.client_email ?? ""}
              onChange={(e) => update("client_email", e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Business type
              </label>
              <div className="relative">
                <Building2
                  size={16}
                  strokeWidth={1.8}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <select
                  value={lead.client_business_type ?? ""}
                  onChange={(e) => update("client_business_type", e.target.value || null)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">(select)</option>
                  {BUSINESS_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {assignedToField}
          </div>
        </div>
      </Card>

      {/* Product */}
      <Card>
        <CardHeader>
          <CardTitle>Product</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {(lead.products ?? []).map((row, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <Input
                id={`product_qty_${i}`}
                label="Quantity"
                icon={Package}
                type="number"
                min={1}
                value={String(row.qty ?? 1)}
                onChange={(e) => updateProductRow(i, "qty", Number(e.target.value) || 1)}
              />
              <div className="md:col-span-2 flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    RO Unit / Model
                  </label>
                  <div className="relative">
                    <Package
                      size={16}
                      strokeWidth={1.8}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <select
                      value={row.model ?? ""}
                      onChange={(e) => updateProductRow(i, "model", e.target.value || null)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">(select model)</option>
                      {/* Keep any legacy/custom value selectable so editing an old lead
                          doesn't silently drop its model. */}
                      {row.model && !PRODUCT_MODEL_OPTIONS.some((o) => o.value === row.model) && (
                        <option value={row.model}>{row.model}</option>
                      )}
                      {PRODUCT_MODEL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {(lead.products?.length ?? 0) > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProductRow(i)}
                    className="p-2.5 rounded-lg border border-border text-text-muted hover:text-error hover:border-error/40 transition-colors"
                    aria-label="Remove product"
                  >
                    <Trash2 size={16} strokeWidth={1.8} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addProductRow}>
            <Plus size={14} strokeWidth={2} />
            Add product
          </Button>
        </div>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>Paste a Google Maps share link OR enter the address.</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          {cityField}
          <Input
            id="location_address"
            label="Address"
            icon={MapPin}
            value={lead.location_address ?? ""}
            onChange={(e) => update("location_address", e.target.value)}
          />
          <Input
            id="location_url"
            label="Google Maps URL"
            icon={Globe2}
            placeholder="https://maps.app.goo.gl/..."
            value={lead.location_url ?? ""}
            onChange={(e) => update("location_url", e.target.value)}
          />
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Textarea
            id="remarks"
            label="Remarks (customer-facing)"
            rows={3}
            value={lead.remarks ?? ""}
            onChange={(e) => update("remarks", e.target.value)}
          />
          <Textarea
            id="internal_notes"
            label="Internal notes"
            rows={3}
            value={lead.internal_notes ?? ""}
            onChange={(e) => update("internal_notes", e.target.value)}
          />
        </div>
      </Card>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3 pt-2">
        {status && (
          <div
            className={`flex items-center gap-1.5 text-sm ${
              status.type === "success" ? "text-success" : "text-error"
            }`}
          >
            {status.type === "success" ? (
              <CheckCircle size={14} strokeWidth={1.8} />
            ) : (
              <AlertCircle size={14} strokeWidth={1.8} />
            )}
            {status.message}
          </div>
        )}
        <div className="flex-1" />
        {mode === "edit" && (
          <Button variant="danger" onClick={handleDelete} disabled={saving || deleting}>
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} strokeWidth={1.8} />}
            Delete
          </Button>
        )}
        <Button onClick={handleSave} loading={saving}>
          {mode === "create" ? "Create Lead" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
