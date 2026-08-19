"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, Phone, MapPin, Building2, ArrowRight, AlertCircle } from "lucide-react";
import { CALL_STATUS_COLORS, CALL_STATUS_OPTIONS } from "@/lib/lead-status";

interface LeadDetailsPopupProps {
  leadId: string;
  onClose: () => void;
}

interface LeadDetails {
  client_name: string;
  client_phone: string | null;
  client_business_type: string | null;
  city: string | null;
  assigned_to: string | null;
  call_status: string | null;
  product_model: string | null;
  product_qty: number | null;
  remarks: string | null;
}

/** Quick-glance popup for a lead's core details, without navigating away from the calendar. */
export function LeadDetailsPopup({ leadId, onClose }: LeadDetailsPopupProps) {
  const [lead, setLead] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/leads/${leadId}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) {
          setError(json.error?.message ?? "Failed to load lead");
          return;
        }
        setLead(json.data.lead as LeadDetails);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const statusLabel = lead?.call_status
    ? (CALL_STATUS_OPTIONS.find((o) => o.value === lead.call_status)?.label ?? lead.call_status)
    : null;
  const statusColor = lead?.call_status ? CALL_STATUS_COLORS[lead.call_status] : "";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface-elevated border border-border rounded-xl shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Lead details</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-text-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-text-muted">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : error ? (
              <p className="flex items-center gap-1.5 text-sm text-error">
                <AlertCircle size={14} strokeWidth={1.8} />
                {error}
              </p>
            ) : lead ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-semibold text-foreground">{lead.client_name}</p>
                  {statusLabel && (
                    <span
                      className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  {lead.client_phone && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <Phone size={14} strokeWidth={1.8} className="shrink-0" />
                      <span className="font-mono text-foreground">{lead.client_phone}</span>
                    </div>
                  )}
                  {lead.city && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <MapPin size={14} strokeWidth={1.8} className="shrink-0" />
                      <span className="text-foreground">{lead.city}</span>
                    </div>
                  )}
                  {lead.client_business_type && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <Building2 size={14} strokeWidth={1.8} className="shrink-0" />
                      <span className="text-foreground">{lead.client_business_type}</span>
                    </div>
                  )}
                  {(lead.product_model || lead.product_qty) && (
                    <p className="text-text-muted">
                      Product:{" "}
                      <span className="text-foreground">
                        {lead.product_model ?? "—"}
                        {lead.product_qty ? ` × ${lead.product_qty}` : ""}
                      </span>
                    </p>
                  )}
                  {lead.assigned_to && (
                    <p className="text-text-muted">
                      Assigned to: <span className="text-foreground">{lead.assigned_to}</span>
                    </p>
                  )}
                  {lead.remarks && (
                    <p className="text-text-muted">
                      Remarks: <span className="text-foreground">{lead.remarks}</span>
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end px-5 py-4 border-t border-border">
            <Link
              href={`/leads/${leadId}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover"
            >
              Open full lead
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
