export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import { LeadForm, type Lead } from "@/components/leads/lead-form";
import { LeadFollowups, type Followup } from "@/components/leads/lead-followups";
import { BookingDrawer } from "@/components/bookings/booking-drawer";
import { SendBookingLinkButton } from "@/components/bookings/send-booking-link-button";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ leadId: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { leadId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const tenantId = getTenantId();
  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", tenantId)
    .maybeSingle<Lead>();

  if (!lead) notFound();

  // The lead's active (non-cancelled) booking, if any — so the panel edits it
  // instead of creating a duplicate.
  const { data: existingBooking } = await admin
    .from("bookings")
    .select(
      "id, booking_ref, scheduled_at, slot_label, unit_price, technician, notes, status, technician_id, slot_id"
    )
    .eq("user_id", tenantId)
    .eq("lead_id", leadId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Technicians for the slot picker.
  const { data: technicians } = await admin
    .from("technicians")
    .select("id, name")
    .eq("user_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const { data: followups } = await admin
    .from("lead_followups")
    .select("*")
    .eq("lead_id", leadId)
    .eq("user_id", tenantId)
    .order("follow_up_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.8} />
          Back to leads
        </Link>
        <div className="flex items-center gap-2">
          {lead.booking_token && (
            <SendBookingLinkButton
              token={lead.booking_token}
              customerName={lead.client_name}
              chatChannel={
                lead.whatsapp_conversation_id
                  ? "whatsapp"
                  : lead.messenger_conversation_id
                    ? "messenger"
                    : null
              }
              chatConversationId={
                lead.whatsapp_conversation_id ?? lead.messenger_conversation_id ?? null
              }
            />
          )}
          <BookingDrawer
            leadId={lead.id!}
            hasPhone={Boolean(lead.client_phone?.trim())}
            productModel={lead.product_model ?? null}
            productQty={lead.product_qty ?? 1}
            leadStatus={lead.status ?? "new"}
            existingBooking={existingBooking ?? null}
            technicians={(technicians ?? []) as { id: string; name: string }[]}
            chatChannel={
              lead.whatsapp_conversation_id
                ? "whatsapp"
                : lead.messenger_conversation_id
                  ? "messenger"
                  : null
            }
            chatConversationId={
              lead.whatsapp_conversation_id ?? lead.messenger_conversation_id ?? null
            }
          />
        </div>
      </div>
      <LeadForm mode="edit" initialLead={lead} />
      <div className="mt-6">
        <LeadFollowups leadId={lead.id!} initialFollowups={(followups ?? []) as Followup[]} />
      </div>
    </div>
  );
}
