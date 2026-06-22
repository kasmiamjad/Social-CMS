"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck,
  Clock,
  Loader2,
  CheckCircle,
  AlertCircle,
  User,
  Phone,
  CalendarClock,
} from "lucide-react";
import { LocationPicker } from "./location-picker";

interface ExistingBooking {
  ref: string | null;
  dateLabel: string;
  timeLabel: string;
  status: string;
}

interface CustomerBookingProps {
  token: string;
  customerName: string;
  customerPhone: string | null;
  product: string | null;
  existingBooking?: ExistingBooking | null;
}

interface TimeSlot {
  start_time: string;
  end_time: string;
}

/** "12:00:00" → "12:00 PM". */
function fmtTime(t: string): string {
  const [h, m] = t.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${ampm}`;
}

function riyadhToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20";

/**
 * Public self-scheduling page. Collects the customer's details + GPS location
 * (shown on a map) and an open 1-hour slot, then books any free technician slot.
 * Location is required — submit stays disabled until it's captured.
 */
export function CustomerBooking({
  token,
  customerName,
  customerPhone,
  product,
  existingBooking,
}: CustomerBookingProps) {
  const today = riyadhToday();
  // A finished install is read-only; an active booking becomes a reschedule.
  const isCompleted = existingBooking?.status === "completed";
  const isReschedule = Boolean(existingBooking) && !isCompleted;
  const [name, setName] = useState(customerName ?? "");
  const [phone, setPhone] = useState(customerPhone ?? "");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [date, setDate] = useState(today);
  const [times, setTimes] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TimeSlot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string | null; date: string; time: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/v1/book/${token}/slots?date=${date}`);
      const json = await res.json();
      setTimes(res.ok && json.success ? (json.data.times as TimeSlot[]) : []);
    } catch {
      setTimes([]);
    } finally {
      setLoading(false);
    }
  }, [token, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const canConfirm =
    Boolean(selected) && name.trim().length > 0 && phone.trim().length >= 5 && coords !== null;

  async function confirm() {
    if (!selected || !coords) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/book/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_date: date,
          start_time: selected.start_time,
          end_time: selected.end_time,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim() || null,
          lat: coords.lat,
          lng: coords.lng,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Could not book — please try again.");
        if (res.status === 409) void load();
        return;
      }
      setDone({ ref: json.data.booking_ref, date: json.data.date, time: json.data.time });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-elevated shadow-sm p-6 sm:p-8">
        {isCompleted && existingBooking ? (
          <div className="text-center py-4">
            <CheckCircle size={44} strokeWidth={1.6} className="text-success mx-auto mb-3" />
            <h1 className="text-xl font-bold text-foreground">Installation complete</h1>
            <p className="text-sm text-text-muted mt-2">Your installation was completed on</p>
            <p className="text-base font-semibold text-foreground mt-1">{existingBooking.dateLabel}</p>
            {existingBooking.ref && (
              <p className="text-xs text-text-muted mt-3 font-mono">Ref: {existingBooking.ref}</p>
            )}
            <p className="text-xs text-text-muted mt-4">Thank you for choosing SA&apos;DA H2O. 💧</p>
          </div>
        ) : done ? (
          <div className="text-center py-4">
            <CheckCircle size={44} strokeWidth={1.6} className="text-success mx-auto mb-3" />
            <h1 className="text-xl font-bold text-foreground">
              {isReschedule ? "Updated! 🎉" : "You're booked! 🎉"}
            </h1>
            <p className="text-sm text-text-muted mt-2">
              {isReschedule ? "Your installation has been moved to" : "Your installation is confirmed for"}
            </p>
            <p className="text-base font-semibold text-foreground mt-1">
              {done.date} at {done.time}
            </p>
            {done.ref && <p className="text-xs text-text-muted mt-3 font-mono">Ref: {done.ref}</p>}
            <p className="text-xs text-text-muted mt-4">
              Our technician will arrive at your location. Thank you!
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck size={20} strokeWidth={1.8} className="text-primary" />
              <h1 className="text-lg font-bold text-foreground">
                {isReschedule ? "Reschedule your installation" : "Schedule your installation"}
              </h1>
            </div>
            <p className="text-sm text-text-muted">
              {isReschedule
                ? `Hi ${(name || customerName).split(" ")[0]}, pick a new time below to change your appointment.`
                : `Hi ${(name || customerName).split(" ")[0]}, fill in your details and pick a time${
                    product ? ` to install your ${product}` : ""
                  }.`}
            </p>

            {/* Already-scheduled banner → reschedule, not a new booking */}
            {isReschedule && existingBooking && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
                <CalendarClock size={16} strokeWidth={1.8} className="text-primary mt-0.5 shrink-0" />
                <div className="text-xs text-foreground">
                  You&apos;re already scheduled for{" "}
                  <span className="font-semibold">
                    {existingBooking.dateLabel} at {existingBooking.timeLabel}
                  </span>
                  . Picking a new time below will <span className="font-semibold">update</span> this
                  appointment — it won&apos;t create a second one.
                </div>
              </div>
            )}

            {/* Details */}
            <div className="mt-6 space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Your name</label>
                <div className="relative">
                  <User size={15} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} pl-9`} placeholder="Full name" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Phone number</label>
                <div className="relative">
                  <Phone size={15} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputCls} pl-9`} placeholder="+9665XXXXXXXX" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Address details <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Building, floor, landmark…" />
              </div>
            </div>

            {/* Location */}
            <label className="block text-sm font-medium text-foreground mt-5 mb-1.5">
              Your location <span className="text-error">*</span>
            </label>
            <LocationPicker value={coords} onChange={(lat, lng) => setCoords({ lat, lng })} />

            {/* Date */}
            <label className="block text-sm font-medium text-foreground mt-5 mb-1.5">Date</label>
            <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />

            {/* Times */}
            <label className="block text-sm font-medium text-foreground mt-5 mb-2">Available times</label>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-text-muted">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : times.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                No times available on this day. Please try another date.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {times.map((t) => {
                  const isSel = selected?.start_time === t.start_time;
                  return (
                    <button
                      key={t.start_time}
                      type="button"
                      onClick={() => setSelected(t)}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        isSel ? "border-primary bg-primary text-white" : "border-border hover:border-primary text-foreground"
                      }`}
                    >
                      <Clock size={13} strokeWidth={1.8} />
                      {fmtTime(t.start_time)}
                    </button>
                  );
                })}
              </div>
            )}

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-error mt-3">
                <AlertCircle size={13} strokeWidth={1.8} /> {error}
              </p>
            )}

            <button
              type="button"
              onClick={confirm}
              disabled={!canConfirm || submitting}
              className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CalendarCheck size={16} strokeWidth={1.8} />}
              {!coords
                ? "Share your location to continue"
                : !selected
                  ? "Pick a time"
                  : isReschedule
                    ? `Update to ${fmtTime(selected.start_time)}`
                    : `Confirm ${fmtTime(selected.start_time)}`}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
