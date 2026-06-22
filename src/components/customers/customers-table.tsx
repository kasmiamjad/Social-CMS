"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldX,
  Package,
  Phone,
  MapPin,
  ExternalLink,
  X,
  Wrench,
  Clock,
  StickyNote,
  ChevronRight,
} from "lucide-react";

export interface InstallPhoto {
  id: string;
  url: string;
  kind: string;
  caption: string | null;
}

export interface CustomerInstall {
  id: string;
  booking_ref: string;
  product_snapshot: string | null;
  qty_snapshot: number;
  technician: string | null;
  completion_notes: string | null;
  tech_notes: string | null;
  on_the_way_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  lead: {
    client_name: string;
    client_phone: string | null;
    location_address: string | null;
    location_url: string | null;
  } | null;
  /** ISO of the actual install date (completed_at, or scheduled fallback). */
  installedAt: string;
  warrantyExpiry: string;
  warrantyActive: boolean;
  photos: InstallPhoto[];
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Riyadh",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const STAMP_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Riyadh",
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function fmtDate(iso: string | null): string {
  return iso ? DATE_FMT.format(new Date(iso)) : "—";
}

function WarrantyChip({ active, expiry }: { active: boolean; expiry: string }) {
  return active ? (
    <Badge variant="success">
      <ShieldCheck size={11} strokeWidth={2} />
      Until {fmtDate(expiry)}
    </Badge>
  ) : (
    <Badge variant="error">
      <ShieldX size={11} strokeWidth={2} />
      Expired {fmtDate(expiry)}
    </Badge>
  );
}

export function CustomersTable({ installs }: { installs: CustomerInstall[] }) {
  const [active, setActive] = useState<CustomerInstall | null>(null);

  if (installs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>No completed installations yet.</CardDescription>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-text-muted max-w-md">
            When a technician marks a job <span className="font-semibold text-foreground">completed</span>, the
            customer appears here with their warranty status and site photos.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Installed</th>
                <th className="px-4 py-3 font-semibold">Technician</th>
                <th className="px-4 py-3 font-semibold">Warranty</th>
                <th className="px-4 py-3 font-semibold w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {installs.map((i) => (
                <tr
                  key={i.id}
                  className="hover:bg-surface transition-colors cursor-pointer"
                  onClick={() => setActive(i)}
                >
                  <td className="px-4 py-3">
                    <div className="text-foreground font-medium">{i.lead?.client_name ?? "—"}</div>
                    <div className="text-text-muted text-[10px] font-mono mt-0.5">{i.booking_ref}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground text-xs whitespace-nowrap">
                    {i.product_snapshot ?? "Water purifier"}
                    <span className="text-text-muted"> ×{i.qty_snapshot}</span>
                  </td>
                  <td className="px-4 py-3 text-foreground text-xs whitespace-nowrap">
                    {fmtDate(i.installedAt)}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">{i.technician ?? "—"}</td>
                  <td className="px-4 py-3">
                    <WarrantyChip active={i.warrantyActive} expiry={i.warrantyExpiry} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight size={14} strokeWidth={1.8} className="text-text-muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {active && <InstallDrawer install={active} onClose={() => setActive(null)} />}
    </>
  );
}

function InstallDrawer({ install, onClose }: { install: CustomerInstall; onClose: () => void }) {
  const timeline = [
    { label: "On the way", at: install.on_the_way_at },
    { label: "Arrived", at: install.arrived_at },
    { label: "Completed", at: install.completed_at },
  ].filter((s) => s.at);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md h-full bg-surface-elevated border-l border-border overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface-elevated border-b border-border px-5 py-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">
              {install.lead?.client_name ?? "Customer"}
            </h2>
            <div className="text-[11px] text-text-muted font-mono">{install.booking_ref}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface text-text-muted hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Warranty */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-text-muted">Warranty</span>
            <WarrantyChip active={install.warrantyActive} expiry={install.warrantyExpiry} />
          </div>

          {/* Key facts */}
          <div className="space-y-2.5">
            <Row icon={Package} label="Product">
              {install.product_snapshot ?? "Water purifier"} ×{install.qty_snapshot}
            </Row>
            <Row icon={Clock} label="Installed on">
              {fmtDate(install.installedAt)}
            </Row>
            <Row icon={Wrench} label="Technician">
              {install.technician ?? "—"}
            </Row>
            <Row icon={Phone} label="Phone">
              {install.lead?.client_phone ? (
                <a href={`tel:${install.lead.client_phone}`} className="text-primary">
                  {install.lead.client_phone}
                </a>
              ) : (
                "—"
              )}
            </Row>
            <Row icon={MapPin} label="Location">
              {install.lead?.location_url ? (
                <a
                  href={install.lead.location_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary"
                >
                  Map <ExternalLink size={10} strokeWidth={2} />
                </a>
              ) : (
                install.lead?.location_address ?? "—"
              )}
            </Row>
          </div>

          {/* Visit timeline */}
          {timeline.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-muted mb-2">Visit timeline</div>
              <ul className="space-y-1.5">
                {timeline.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                    <span className="text-foreground font-medium">{s.label}</span>
                    <span className="text-text-muted">· {STAMP_FMT.format(new Date(s.at!))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {(install.completion_notes || install.tech_notes) && (
            <div className="space-y-2">
              {install.completion_notes && (
                <NoteBlock label="Completion notes">{install.completion_notes}</NoteBlock>
              )}
              {install.tech_notes && <NoteBlock label="Job notes">{install.tech_notes}</NoteBlock>}
            </div>
          )}

          {/* Photos */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted mb-2">
              Site photos {install.photos.length > 0 && `· ${install.photos.length}`}
            </div>
            {install.photos.length === 0 ? (
              <p className="text-xs text-text-muted">No photos uploaded for this job.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {install.photos.map((p) => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                    title={p.caption ?? p.kind}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-surface border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.caption ?? p.kind} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    {p.caption && (
                      <p className="text-[10px] text-text-muted mt-1 line-clamp-2 leading-snug">{p.caption}</p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={15} strokeWidth={1.8} className="text-text-muted mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 flex items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wide text-text-muted">{label}</span>
        <span className="text-sm text-foreground text-right break-words">{children}</span>
      </div>
    </div>
  );
}

function NoteBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-text-muted mb-1">{label}</div>
      <div className="text-sm text-foreground whitespace-pre-wrap">{children}</div>
    </div>
  );
}
