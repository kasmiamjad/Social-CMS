"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, Phone, MapPin, Building2, ArrowRight, AlertCircle, Check } from "lucide-react";
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
  source: string | null;
  product_model: string | null;
  product_qty: number | null;
  remarks: string | null;
}

interface FollowupEntry {
  id: string;
  follow_up_date: string;
  note: string | null;
  logged_by: string | null;
  completed_at: string | null;
}

/** Icon-free label per lead source — matches the labels used in the Leads table's Source column. */
const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  whatsapp_ai: "WhatsApp",
  facebook: "Messenger",
  instagram: "Instagram",
  youtube: "YouTube",
  website_form: "Website",
  phone_call: "Phone call",
  walk_in: "Walk-in",
  referral: "Referral",
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** Quick-glance popup for a lead's core details + its full follow-up history, without navigating away from the calendar. */
export function LeadDetailsPopup({ leadId, onClose }: LeadDetailsPopupProps) {
  const [lead, setLead] = useState<LeadDetails | null>(null);
  const [followups, setFollowups] = useState<FollowupEntry[]>([]);
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
    Promise.all([
      fetch(`/api/v1/leads/${leadId}`).then((res) => res.json()),
      fetch(`/api/v1/leads/${leadId}/followups`).then((res) => res.json()),
    ])
      .then(([leadJson, followupsJson]) => {
        if (cancelled) return;
        if (!leadJson.success) {
          setError(leadJson.error?.message ?? "Failed to load lead");
          return;
        }
        setLead(leadJson.data.lead as LeadDetails);
        if (followupsJson.success) {
          setFollowups(followupsJson.data.followups as FollowupEntry[]);
        }
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
  const sourceLabel = lead?.source ? (SOURCE_LABELS[lead.source] ?? lead.source) : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="w-full max-w-sm max-h-[85vh] flex flex-col bg-surface-elevated border border-border rounded-xl shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
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

          <div className="p-5 overflow-y-auto space-y-6">
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
              <>
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
                        <a href={`tel:${lead.client_phone}`} className="font-mono text-foreground hover:text-primary">
                          {lead.client_phone}
                        </a>
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
                    {sourceLabel && (
                      <p className="text-text-muted">
                        Source: <span className="text-foreground">{sourceLabel}</span>
                      </p>
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

                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">
                    Follow-up history {followups.length > 0 && `(${followups.length})`}
                  </p>
                  {followups.length === 0 ? (
                    <p className="text-sm text-text-muted">No follow-ups logged for this lead.</p>
                  ) : (
                    <ul className="space-y-3">
                      {followups.map((f) => {
                        const done = Boolean(f.completed_at);
                        return (
                          <li key={f.id} className="text-sm border-l-2 border-border pl-3">
                            <div className="flex items-center gap-2">
                              <span className={done ? "text-text-muted line-through" : "text-foreground font-medium"}>
                                {DATE_FMT.format(new Date(f.follow_up_date))}
                              </span>
                              {done && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-success">
                                  <Check size={10} strokeWidth={3} />
                                  Done
                                </span>
                              )}
                              {f.logged_by && <span className="text-xs text-text-muted">· {f.logged_by}</span>}
                            </div>
                            {f.note && (
                              <p className={`mt-0.5 ${done ? "text-text-muted/70" : "text-text-muted"}`}>{f.note}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-end px-5 py-4 border-t border-border shrink-0">
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
