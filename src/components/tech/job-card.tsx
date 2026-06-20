import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, Clock, ExternalLink, Package } from "lucide-react";

export interface TechJob {
  id: string;
  scheduled_at: string;
  slot_label: string | null;
  product_snapshot: string | null;
  qty_snapshot: number;
  status: string;
  lead: {
    client_name: string;
    client_phone: string | null;
    location_url: string | null;
    location_address: string | null;
  } | null;
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "processing"> = {
  scheduled: "processing",
  confirmed: "processing",
  on_the_way: "warning",
  arrived: "warning",
  completed: "success",
  cancelled: "error",
  no_show: "error",
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Riyadh",
  weekday: "short",
  day: "2-digit",
  month: "short",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Riyadh",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function JobCard({ job, showDate }: { job: TechJob; showDate?: boolean }) {
  const when = new Date(job.scheduled_at);
  const time = job.slot_label?.trim() || TIME_FMT.format(when);

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-semibold text-foreground truncate">
            {job.lead?.client_name ?? "Customer"}
          </div>
          <div className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
            <Clock size={12} strokeWidth={1.8} />
            {showDate ? `${DATE_FMT.format(when)} · ${time}` : time}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[job.status] ?? "default"}>
          {job.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="text-sm text-foreground mt-2 flex items-center gap-1.5">
        <Package size={14} strokeWidth={1.8} className="text-text-muted" />
        {job.product_snapshot ?? "Water purifier"} <span className="text-text-muted">×{job.qty_snapshot}</span>
      </div>

      {job.lead?.location_address && (
        <div className="text-xs text-text-muted mt-1.5 flex items-start gap-1.5">
          <MapPin size={13} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <span>{job.lead.location_address}</span>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-2 mt-3">
        {job.lead?.client_phone && (
          <a
            href={`tel:${job.lead.client_phone}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-foreground text-xs font-semibold hover:bg-surface"
          >
            <Phone size={14} strokeWidth={1.8} /> Call
          </a>
        )}
        {job.lead?.location_url && (
          <a
            href={job.lead.location_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-foreground text-xs font-semibold hover:bg-surface"
          >
            <MapPin size={14} strokeWidth={1.8} /> Maps <ExternalLink size={10} strokeWidth={2} />
          </a>
        )}
      </div>
    </div>
  );
}
