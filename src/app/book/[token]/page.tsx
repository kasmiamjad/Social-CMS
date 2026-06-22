export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { CustomerBooking } from "@/components/booking-link/customer-booking";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function BookPage({ params }: PageProps) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("id, client_name, client_phone, product_model")
    .eq("booking_token", token)
    .maybeSingle<{ id: string; client_name: string; client_phone: string | null; product_model: string | null }>();

  if (!lead) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Invalid link</h1>
          <p className="text-sm text-text-muted mt-2">
            This booking link is not valid or has expired.
          </p>
        </div>
      </main>
    );
  }

  // Surface any existing (non-cancelled) booking so the customer sees they're
  // already scheduled and reschedules instead of thinking it's a fresh booking.
  const { data: booking } = await admin
    .from("bookings")
    .select("booking_ref, scheduled_at, slot_label, status")
    .eq("lead_id", lead.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      booking_ref: string;
      scheduled_at: string;
      slot_label: string | null;
      status: string;
    }>();

  const existingBooking = booking
    ? {
        ref: booking.booking_ref,
        dateLabel: BOOK_DATE_FMT.format(new Date(booking.scheduled_at)),
        timeLabel: booking.slot_label?.trim() || BOOK_TIME_FMT.format(new Date(booking.scheduled_at)),
        status: booking.status,
      }
    : null;

  return (
    <CustomerBooking
      token={token}
      customerName={lead.client_name}
      customerPhone={lead.client_phone}
      product={lead.product_model}
      existingBooking={existingBooking}
    />
  );
}

const BOOK_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Riyadh",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const BOOK_TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Riyadh",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
