"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChatDrawer, type ActiveChat } from "./chat-drawer";
import { TEAM_MEMBER_COLORS } from "@/lib/team";
import { CALL_STATUS_OPTIONS, CALL_STATUS_COLORS } from "@/lib/lead-status";
import {
  ChevronRight,
  ExternalLink,
  MapPin,
  MessageCircle,
  Send,
  Camera,
  Globe,
  PhoneCall,
  User,
  Users,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";

export interface LeadRow {
  id: string;
  serial_no: number;
  client_code: string | null;
  client_name: string;
  client_phone: string | null;
  client_business_type: string | null;
  product_qty: number | null;
  product_model: string | null;
  installation_date: string | null;
  next_service_date: string | null;
  scope: string | null;
  installed_by: string | null;
  location_address: string | null;
  location_url: string | null;
  city?: string | null;
  assigned_to?: string | null;
  call_status?: string | null;
  status: string;
  source: string;
  remarks: string | null;
  created_at: string;
  /** Last inbound (customer) message from the linked chat, if any. */
  last_customer_msg?: string | null;
  /** Total messages in the linked chat (both directions). */
  chat_count?: number;
  /** Which channel the linked chat is on (for opening the chat drawer). */
  chat_channel?: "whatsapp" | "messenger" | "instagram" | null;
  /** Linked conversation id (for opening the chat drawer). */
  chat_conversation_id?: string | null;
  /** Who added the lead — the user's name (manual) or "AI Bot". */
  added_by?: string | null;
  /** Date of the most recently logged follow-up entry, if any. */
  next_followup?: string | null;
}

/** Icon + label per lead source for the Source column. */
const SOURCE_META: Record<string, { icon: LucideIcon; label: string }> = {
  manual: { icon: User, label: "Manual" },
  whatsapp_ai: { icon: MessageCircle, label: "WhatsApp" },
  facebook: { icon: Send, label: "Messenger" },
  instagram: { icon: Camera, label: "Instagram" },
  youtube: { icon: PlayCircle, label: "YouTube" },
  website_form: { icon: Globe, label: "Website" },
  phone_call: { icon: PhoneCall, label: "Phone call" },
  walk_in: { icon: User, label: "Walk-in" },
  referral: { icon: Users, label: "Referral" },
};

interface LeadsTableProps {
  leads: LeadRow[];
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

const FOLLOWUP_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export function LeadsTable({ leads }: LeadsTableProps) {
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);

  if (leads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
          <CardDescription>No leads yet.</CardDescription>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-text-muted max-w-md">
            Leads from WhatsApp &amp; Messenger chats appear here automatically when a customer
            messages you. You can also add leads manually with the button above.
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
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Ref No</th>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Last chat</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Unit</th>
              <th className="px-4 py-3 font-semibold">Added by</th>
              <th className="px-4 py-3 font-semibold">Assigned</th>
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Stage</th>
              <th className="px-4 py-3 font-semibold">Next follow-up</th>
              <th className="px-4 py-3 font-semibold w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-surface transition-colors group">
                <td className="px-4 py-3 text-foreground font-mono text-xs">
                  {lead.serial_no}
                </td>
                <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                  {lead.installation_date
                    ? new Date(lead.installation_date).toLocaleDateString()
                    : new Date(lead.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-foreground font-mono text-xs whitespace-nowrap">
                  {lead.client_code?.trim() || `LD-${String(lead.serial_no).padStart(4, "0")}`}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-foreground font-medium hover:text-primary"
                  >
                    {lead.client_name}
                  </Link>
                  {lead.client_phone && (
                    <div className="text-text-muted text-[10px] font-mono mt-0.5">
                      {lead.client_phone}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <SourceCell source={lead.source} />
                </td>
                <td className="px-4 py-3">
                  {lead.chat_count && lead.chat_count > 0 && lead.chat_channel && lead.chat_conversation_id ? (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveChat({
                          channel: lead.chat_channel!,
                          conversationId: lead.chat_conversation_id!,
                          name: lead.client_name,
                        })
                      }
                      className="max-w-[220px] text-left group/chat"
                      title="Open chat"
                    >
                      <div className="flex items-center gap-1 text-xs text-primary group-hover/chat:underline truncate">
                        <MessageCircle size={12} strokeWidth={1.8} className="shrink-0" />
                        <span className="truncate">{lead.last_customer_msg?.trim() || "(no text)"}</span>
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {lead.chat_count} message{lead.chat_count === 1 ? "" : "s"} · open
                      </div>
                    </button>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                  {lead.client_business_type ?? "—"}
                </td>
                <td className="px-4 py-3 text-foreground text-xs whitespace-nowrap">
                  {lead.product_model ?? "—"}
                </td>
                <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                  {lead.added_by ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {lead.assigned_to ? (
                    <Badge className={TEAM_MEMBER_COLORS[lead.assigned_to] ?? "bg-surface text-text-muted"}>
                      {lead.assigned_to}
                    </Badge>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {lead.location_url ? (
                    <a
                      href={lead.location_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:text-primary-hover text-xs"
                    >
                      <MapPin size={11} strokeWidth={2} />
                      Map <ExternalLink size={9} strokeWidth={2} />
                    </a>
                  ) : lead.location_address ? (
                    <span className="text-text-muted text-xs">{lead.location_address}</span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {lead.call_status ? (
                    <Badge className={CALL_STATUS_COLORS[lead.call_status] ?? "bg-surface text-text-muted"}>
                      {CALL_STATUS_OPTIONS.find((o) => o.value === lead.call_status)?.label ?? lead.call_status}
                    </Badge>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[lead.status] ?? "default"}>
                    {lead.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {lead.next_followup ? (
                    <span
                      className={`text-xs font-medium ${
                        lead.next_followup < todayIso ? "text-error" : "text-foreground"
                      }`}
                    >
                      {FOLLOWUP_FMT.format(new Date(lead.next_followup))}
                      {lead.next_followup < todayIso && " (overdue)"}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/leads/${lead.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight size={14} strokeWidth={1.8} className="text-text-muted" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
    {activeChat && <ChatDrawer chat={activeChat} onClose={() => setActiveChat(null)} />}
    </>
  );
}

/** Source icon + label for a lead (manual / WhatsApp / Messenger / etc.). */
function SourceCell({ source }: { source: string }) {
  const meta = SOURCE_META[source] ?? { icon: User, label: source };
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-text-muted whitespace-nowrap"
      title={meta.label}
    >
      <Icon size={14} strokeWidth={1.8} className="text-foreground shrink-0" />
      {meta.label}
    </span>
  );
}
