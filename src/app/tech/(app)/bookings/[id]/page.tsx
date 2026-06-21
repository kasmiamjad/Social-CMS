export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  MapPin,
  ExternalLink,
  Package,
  CalendarClock,
  User,
  Mail,
  Building2,
  Wrench,
  StickyNote,
  Hash,
  Camera,
} from "lucide-react";
import { getTechSession } from "@/lib/tech-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { JobStatusActions } from "@/components/tech/job-status-actions";
import { JobPhotos, type JobPhoto } from "@/components/tech/job-photos";
import { JobNotes } from "@/components/tech/job-notes";
import {
  BOOKING_DATE_LONG_FMT,
  BOOKING_TIME_FMT,
  bookingStatusLabel,
  bookingStatusVariant,
} from "@/lib/booking-display";

interface JobDetailLead {
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_business_type: string | null;
  scope: string | null;
  remarks: string | null;
  location_address: string | null;
  location_url: string | null;
  location_lat: number | null;
  location_lng: number | null;
}

interface JobDetail {
  id: string;
  booking_ref: string;
  scheduled_at: string;
  slot_label: string | null;
  product_snapshot: string | null;
  qty_snapshot: number;
  total_amount: number | null;
  currency: string;
  address_snapshot: string | null;
  notes: string | null;
  tech_notes: string | null;
  status: string;
  on_the_way_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  lead: JobDetailLead | null;
}

/** Builds an OpenStreetMap embed URL (no API key) centred on the pin. */
function osmEmbedUrl(lat: number, lng: number): string {
  const d = 0.004; // ~400m box around the point
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

function formatMoney(amount: number | null, currency: string): string | null {
  if (amount == null) return null;
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** A labelled detail row: icon + label on the left, value on the right. */
function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} strokeWidth={1.8} className="text-text-muted mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
        <div className="text-sm text-foreground break-words">{children}</div>
      </div>
    </div>
  );
}

export default async function TechJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getTechSession();
  if (!session) return null;

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(
      "id, booking_ref, scheduled_at, slot_label, product_snapshot, qty_snapshot, total_amount, currency, address_snapshot, notes, tech_notes, status, on_the_way_at, arrived_at, completed_at, completion_notes, lead:leads(client_name, client_phone, client_email, client_business_type, scope, remarks, location_address, location_url, location_lat, location_lng)"
    )
    .eq("id", id)
    .eq("user_id", session.uid)
    .eq("technician_id", session.tid)
    .maybeSingle();

  // A query error (e.g. schema drift — a column not yet migrated) is NOT the same
  // as a missing booking. Surface it loudly instead of rendering a misleading 404.
  if (error) {
    throw new Error(`Failed to load booking ${id}: ${error.message}`);
  }
  // notFound() covers a real missing booking, or one not assigned to this tech.
  if (!data) notFound();

  const job = data as unknown as JobDetail;
  const lead = job.lead;
  const when = new Date(job.scheduled_at);

  // Site photos for this booking (newest first), scoped to the owner.
  const { data: photoRows } = await admin
    .from("booking_photos")
    .select("id, url, kind, caption, created_at")
    .eq("booking_id", job.id)
    .eq("user_id", session.uid)
    .order("created_at", { ascending: false });
  const photos = (photoRows ?? []) as JobPhoto[];
  const time = job.slot_label?.trim() || BOOKING_TIME_FMT.format(when);
  const address = lead?.location_address ?? job.address_snapshot;
  const total = formatMoney(job.total_amount, job.currency);
  const hasPin = lead?.location_lat != null && lead?.location_lng != null;

  return (
    <div className="space-y-4">
      <Link
        href="/tech/bookings"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground"
      >
        <ArrowLeft size={16} strokeWidth={1.8} /> All bookings
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">
              {lead?.client_name ?? "Customer"}
            </h1>
            <div className="text-xs text-text-muted flex items-center gap-1 mt-1">
              <Hash size={12} strokeWidth={1.8} />
              {job.booking_ref}
            </div>
          </div>
          <Badge variant={bookingStatusVariant(job.status)}>
            {bookingStatusLabel(job.status)}
          </Badge>
        </div>

        {/* Primary actions */}
        <div className="flex items-center gap-2 mt-4">
          {lead?.client_phone && (
            <a
              href={`tel:${lead.client_phone}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
            >
              <Phone size={15} strokeWidth={1.8} /> Call
            </a>
          )}
          {lead?.location_url && (
            <a
              href={lead.location_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-surface"
            >
              <MapPin size={15} strokeWidth={1.8} /> Directions{" "}
              <ExternalLink size={11} strokeWidth={2} />
            </a>
          )}
        </div>
      </div>

      {/* Status / field actions */}
      <section className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="text-[11px] uppercase tracking-wide text-text-muted mb-3">Job status</div>
        <JobStatusActions
          bookingId={job.id}
          status={job.status}
          onTheWayAt={job.on_the_way_at}
          arrivedAt={job.arrived_at}
          completedAt={job.completed_at}
          completionNotes={job.completion_notes}
        />
      </section>

      {/* Site photos */}
      <section className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-text-muted mb-3">
          <Camera size={13} strokeWidth={1.8} /> Site photos
        </div>
        <JobPhotos bookingId={job.id} photos={photos} />
      </section>

      {/* Job notes (technician-editable) */}
      <section className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-text-muted mb-3">
          <StickyNote size={13} strokeWidth={1.8} /> Job notes
        </div>
        <JobNotes bookingId={job.id} initialNotes={job.tech_notes} />
      </section>

      {/* Schedule */}
      <section className="rounded-xl border border-border bg-surface-elevated px-4 divide-y divide-border">
        <InfoRow icon={CalendarClock} label="Scheduled">
          {BOOKING_DATE_LONG_FMT.format(when)}
          <span className="text-text-muted"> · {time}</span>
        </InfoRow>
        <InfoRow icon={Package} label="Product">
          {job.product_snapshot ?? "Water purifier"}{" "}
          <span className="text-text-muted">×{job.qty_snapshot}</span>
          {total && <div className="text-text-muted text-xs mt-0.5">Total {total}</div>}
        </InfoRow>
        {lead?.scope && (
          <InfoRow icon={Wrench} label="Scope">
            {lead.scope}
          </InfoRow>
        )}
      </section>

      {/* Customer */}
      <section className="rounded-xl border border-border bg-surface-elevated px-4 divide-y divide-border">
        <div className="text-[11px] uppercase tracking-wide text-text-muted pt-3 pb-1">
          Customer
        </div>
        <InfoRow icon={User} label="Name">
          {lead?.client_name ?? "—"}
        </InfoRow>
        <InfoRow icon={Phone} label="Phone">
          {lead?.client_phone ? (
            <a href={`tel:${lead.client_phone}`} className="text-primary">
              {lead.client_phone}
            </a>
          ) : (
            <span className="text-text-muted">No phone on file</span>
          )}
        </InfoRow>
        {lead?.client_email && (
          <InfoRow icon={Mail} label="Email">
            {lead.client_email}
          </InfoRow>
        )}
        {lead?.client_business_type && (
          <InfoRow icon={Building2} label="Business type">
            {lead.client_business_type}
          </InfoRow>
        )}
      </section>

      {/* Location */}
      {(address || lead?.location_url || hasPin) && (
        <section className="rounded-xl border border-border bg-surface-elevated overflow-hidden">
          <div className="px-4 divide-y divide-border">
            <div className="text-[11px] uppercase tracking-wide text-text-muted pt-3 pb-1">
              Location
            </div>
            <InfoRow icon={MapPin} label="Address">
              {address ?? <span className="text-text-muted">No address provided</span>}
            </InfoRow>
          </div>
          {hasPin && (
            <iframe
              title="Job location map"
              className="w-full h-56 border-0 block"
              loading="lazy"
              src={osmEmbedUrl(lead!.location_lat!, lead!.location_lng!)}
            />
          )}
        </section>
      )}

      {/* Notes */}
      {(job.notes || lead?.remarks) && (
        <section className="rounded-xl border border-border bg-surface-elevated px-4 divide-y divide-border">
          <div className="text-[11px] uppercase tracking-wide text-text-muted pt-3 pb-1">
            Notes
          </div>
          {job.notes && (
            <InfoRow icon={StickyNote} label="Booking notes">
              {job.notes}
            </InfoRow>
          )}
          {lead?.remarks && (
            <InfoRow icon={StickyNote} label="Lead remarks">
              {lead.remarks}
            </InfoRow>
          )}
        </section>
      )}
    </div>
  );
}
