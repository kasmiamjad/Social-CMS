"use client";

import { useEffect, useState } from "react";
import {
  ScheduleBookingPanel,
  type ExistingBooking,
} from "@/components/bookings/schedule-booking-panel";
import { CalendarCheck, X } from "lucide-react";

interface TechnicianOption {
  id: string;
  name: string;
}

interface BookingDrawerProps {
  leadId: string;
  hasPhone: boolean;
  productModel: string | null;
  productQty: number;
  leadStatus: string;
  existingBooking: ExistingBooking | null;
  chatChannel: "whatsapp" | "messenger" | null;
  chatConversationId: string | null;
  technicians: TechnicianOption[];
}

/**
 * Trigger button + right slide-over that houses the Schedule Installation panel,
 * so it's one click away from the lead header instead of buried at the bottom.
 */
export function BookingDrawer(props: BookingDrawerProps) {
  const [open, setOpen] = useState(false);
  const booked = Boolean(props.existingBooking);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors"
      >
        <CalendarCheck size={14} strokeWidth={1.8} />
        {booked ? `Booking ${props.existingBooking!.booking_ref}` : "Schedule Installation"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="fixed right-0 top-0 h-screen w-full max-w-[520px] bg-background border-l border-border z-50 overflow-y-auto shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
            <div className="p-4">
              <ScheduleBookingPanel {...props} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
