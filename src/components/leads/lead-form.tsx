"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_MODEL_OPTIONS } from "@/lib/products";
import {
  AlertCircle,
  CheckCircle,
  User,
  Phone,
  Mail,
  Hash,
  Building2,
  Package,
  Calendar,
  MapPin,
  Wrench,
  Globe2,
  Loader2,
  Trash2,
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
  lead_date?: string | null;
  installation_date?: string | null;
  next_service_date?: string | null;
  scope?: string | null;
  installed_by?: string | null;
  location_address?: string | null;
  location_url?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  status?: string;
  source?: string;
  whatsapp_conversation_id?: string | null;
  messenger_conversation_id?: string | null;
  remarks?: string | null;
  internal_notes?: string | null;
}

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "quoted", label: "Quoted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "scheduled", label: "Scheduled" },
  { value: "installed", label: "Installed" },
  { value: "in_service", label: "In Service" },
];

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
  const [lead, setLead] = useState<Lead>(
    initialLead ?? {
      client_name: "",
      product_qty: 1,
      status: "new",
      source: "manual",
    }
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatusMsg] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  function update<K extends keyof Lead>(key: K, value: Lead[K]) {
    setLead((prev) => ({ ...prev, [key]: value }));
    if (status) setStatusMsg(null);
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
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
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

  return (
    <div className="space-y-6 max-w-4xl">
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
                  : `Source: ${lead.source ?? "manual"} · Status: ${lead.status}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {lead.source === "whatsapp_ai" && lead.whatsapp_conversation_id && (
                <Badge variant="processing">From WhatsApp</Badge>
              )}
              <select
                value={lead.status ?? "new"}
                onChange={(e) => update("status", e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    Status: {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

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
            <Input
              id="client_code"
              label="Client code"
              icon={Hash}
              placeholder="e.g. KBR0018"
              value={lead.client_code ?? ""}
              onChange={(e) => update("client_code", e.target.value)}
            />
            <Input
              id="qr_code"
              label="S.No."
              icon={Hash}
              placeholder="e.g. 1024"
              value={lead.qr_code ?? ""}
              onChange={(e) => update("qr_code", e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Product */}
      <Card>
        <CardHeader>
          <CardTitle>Product</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            id="product_qty"
            label="Quantity"
            icon={Package}
            type="number"
            min={1}
            value={String(lead.product_qty ?? 1)}
            onChange={(e) => update("product_qty", Number(e.target.value) || 1)}
          />
          <div className="md:col-span-2">
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
                value={lead.product_model ?? ""}
                onChange={(e) => update("product_model", e.target.value || null)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">(select model)</option>
                {/* Keep any legacy/custom value selectable so editing an old lead
                    doesn't silently drop its model. */}
                {lead.product_model &&
                  !PRODUCT_MODEL_OPTIONS.some((o) => o.value === lead.product_model) && (
                    <option value={lead.product_model}>{lead.product_model}</option>
                  )}
                {PRODUCT_MODEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Dates</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            id="lead_date"
            label="Lead date"
            type="date"
            icon={Calendar}
            value={lead.lead_date ?? ""}
            onChange={(e) => update("lead_date", e.target.value || null)}
          />
          <Input
            id="installation_date"
            label="Installation date"
            type="date"
            icon={Calendar}
            value={lead.installation_date ?? ""}
            onChange={(e) => update("installation_date", e.target.value || null)}
          />
          <Input
            id="next_service_date"
            label="Next service date"
            type="date"
            icon={Calendar}
            value={lead.next_service_date ?? ""}
            onChange={(e) => update("next_service_date", e.target.value || null)}
          />
        </div>
      </Card>

      {/* Service / Scope */}
      <Card>
        <CardHeader>
          <CardTitle>Service Scope</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Textarea
            id="scope"
            label="Scope of work"
            rows={4}
            placeholder="e.g.&#10;- 3 STAGE FILTERS&#10;- 6 STAGE FILTERS&#10;- INSTALLATION BY SADA TEAM"
            value={lead.scope ?? ""}
            onChange={(e) => update("scope", e.target.value)}
          />
          <Input
            id="installed_by"
            label="Installed by (technician)"
            icon={Wrench}
            placeholder="e.g. ARSHAD KHAN"
            value={lead.installed_by ?? ""}
            onChange={(e) => update("installed_by", e.target.value)}
          />
        </div>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>
            Paste a Google Maps share link OR enter the address. Lat/Lng optional for future map view.
          </CardDescription>
        </CardHeader>
        <div className="space-y-4">
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
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="location_lat"
              label="Latitude (optional)"
              type="number"
              value={lead.location_lat?.toString() ?? ""}
              onChange={(e) =>
                update("location_lat", e.target.value === "" ? null : Number(e.target.value))
              }
            />
            <Input
              id="location_lng"
              label="Longitude (optional)"
              type="number"
              value={lead.location_lng?.toString() ?? ""}
              onChange={(e) =>
                update("location_lng", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </div>
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
