"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, MessageCircle, MapPin, ExternalLink } from "lucide-react";
import { ChatDrawer, type ActiveChat } from "@/components/leads/chat-drawer";

export interface BookingRow {
  id: string;
  booking_ref: string;
  scheduled_at: string;
  slot_label: string | null;
  product_snapshot: string | null;
  qty_snapshot: number;
  total_amount: number | null;
  currency: string;
  technician: string | null;
  status: string;
  lead_id: string;
  lead: {
    client_name: string;
    client_phone: string | null;
    location_url?: string | null;
    location_address?: string | null;
  } | null;
  /** Last customer message from the linked chat, if any. */
  last_customer_msg?: string | null;
  chat_count?: number;
  chat_channel?: "whatsapp" | "messenger" | null;
  chat_conversation_id?: string | null;
}

interface BookingsTableProps {
  bookings: BookingRow[];
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "processing"> = {
  scheduled: "processing",
  confirmed: "success",
  completed: "success",
  cancelled: "error",
  no_show: "warning",
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Riyadh",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Riyadh",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function BookingsTable({ bookings }: BookingsTableProps) {
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);

  if (bookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
          <CardDescription>No bookings yet.</CardDescription>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-text-muted max-w-md">
            Open a lead and use{" "}
            <span className="font-semibold text-foreground">Schedule Installation</span> to
            create a booking. It will appear here.
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
              <th className="px-4 py-3 font-semibold">Ref</th>
              <th className="px-4 py-3 font-semibold">Installation</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Last chat</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Technician</th>
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-surface transition-colors group">
                <td className="px-4 py-3 text-foreground font-mono text-xs whitespace-nowrap">
                  {b.booking_ref}
                </td>
                <td className="px-4 py-3 text-foreground text-xs whitespace-nowrap">
                  <div>{DATE_FMT.format(new Date(b.scheduled_at))}</div>
                  <div className="text-text-muted text-[10px]">
                    {b.slot_label?.trim() || TIME_FMT.format(new Date(b.scheduled_at))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/leads/${b.lead_id}`}
                    className="text-foreground font-medium hover:text-primary"
                  >
                    {b.lead?.client_name ?? "—"}
                  </Link>
                  {b.lead?.client_phone && (
                    <div className="text-text-muted text-[10px] font-mono mt-0.5">
                      {b.lead.client_phone}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {b.chat_count && b.chat_count > 0 && b.chat_channel && b.chat_conversation_id ? (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveChat({
                          channel: b.chat_channel!,
                          conversationId: b.chat_conversation_id!,
                          name: b.lead?.client_name ?? "Customer",
                        })
                      }
                      className="max-w-[220px] text-left group/chat"
                      title="Open chat"
                    >
                      <div className="flex items-center gap-1 text-xs text-primary group-hover/chat:underline truncate">
                        <MessageCircle size={12} strokeWidth={1.8} className="shrink-0" />
                        <span className="truncate">{b.last_customer_msg?.trim() || "(no text)"}</span>
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {b.chat_count} message{b.chat_count === 1 ? "" : "s"} · open
                      </div>
                    </button>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-foreground text-xs whitespace-nowrap">
                  {b.product_snapshot ?? "—"}
                  <span className="text-text-muted"> ×{b.qty_snapshot}</span>
                </td>
                <td className="px-4 py-3 text-foreground text-xs whitespace-nowrap">
                  {b.total_amount !== null
                    ? `${b.currency} ${b.total_amount.toLocaleString("en-US")}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-text-muted text-xs">{b.technician ?? "—"}</td>
                <td className="px-4 py-3">
                  {b.lead?.location_url ? (
                    <a
                      href={b.lead.location_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:text-primary-hover text-xs"
                    >
                      <MapPin size={11} strokeWidth={2} />
                      Map <ExternalLink size={9} strokeWidth={2} />
                    </a>
                  ) : b.lead?.location_address ? (
                    <span className="text-text-muted text-xs">{b.lead.location_address}</span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[b.status] ?? "default"}>
                    {b.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/leads/${b.lead_id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
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
