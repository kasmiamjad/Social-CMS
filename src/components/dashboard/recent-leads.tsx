import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronRight } from "lucide-react";

export interface RecentLeadRow {
  id: string;
  serial_no: number;
  client_name: string;
  client_phone: string | null;
  client_business_type: string | null;
  product_model: string | null;
  status: string;
  source: string;
  created_at: string;
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "processing"> = {
  new: "processing",
  contacted: "processing",
  qualified: "warning",
  quoted: "warning",
  won: "success",
  lost: "error",
  scheduled: "processing",
  installed: "success",
  in_service: "success",
};

interface RecentLeadsProps {
  leads: RecentLeadRow[];
}

export function RecentLeads({ leads }: RecentLeadsProps) {
  return (
    <Card padding={false}>
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <CardTitle>Recent Leads</CardTitle>
          <CardDescription>Latest customer enquiries</CardDescription>
        </div>
        <Link
          href="/leads"
          className="text-xs text-primary hover:text-primary-hover font-medium"
        >
          View all →
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-surface flex items-center justify-center mb-3">
            <Users size={20} strokeWidth={1.8} className="text-text-muted" />
          </div>
          <p className="text-sm font-medium text-foreground">No leads yet</p>
          <p className="text-xs text-text-muted mt-1">
            Leads from WhatsApp AI chats will appear here automatically.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/leads/${lead.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center shrink-0">
                  <span className="text-xs font-mono text-text-muted">
                    #{lead.serial_no}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-foreground truncate">
                      {lead.client_name}
                    </div>
                    <Badge variant={STATUS_VARIANT[lead.status] ?? "default"}>
                      {lead.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-text-muted truncate mt-0.5">
                    {[
                      lead.client_business_type,
                      lead.product_model,
                      lead.client_phone,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <ChevronRight
                  size={14}
                  strokeWidth={1.8}
                  className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
