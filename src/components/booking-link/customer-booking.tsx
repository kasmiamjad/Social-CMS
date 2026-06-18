"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Clock, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface CustomerBookingProps {
  token: string;
  customerName: string;
  product: string | null;
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

/**
 * Public self-scheduling page. The customer picks a date, sees only the open
 * 1-hour windows for that day, and confirms — booking any free technician slot.
 */
export function CustomerBooking({ token, customerName, product }: CustomerBookingProps) {
  const today = riyadhToday();
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

  async function confirm() {
    if (!selected) return;
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
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Could not book — please try again.");
        if (res.status === 409) void load(); // refresh availability
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
        {done ? (
          <div className="text-center py-4">
            <CheckCircle size={44} strokeWidth={1.6} className="text-success mx-auto mb-3" />
            <h1 className="text-xl font-bold text-foreground">You&apos;re booked! 🎉</h1>
            <p className="text-sm text-text-muted mt-2">
              Your installation is confirmed for
            </p>
            <p className="text-base font-semibold text-foreground mt-1">
              {done.date} at {done.time}
            </p>
            {done.ref && (
              <p className="text-xs text-text-muted mt-3 font-mono">Ref: {done.ref}</p>
            )}
            <p className="text-xs text-text-muted mt-4">
              Our technician will arrive at your address. Thank you!
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck size={20} strokeWidth={1.8} className="text-primary" />
              <h1 className="text-lg font-bold text-foreground">Schedule your installation</h1>
            </div>
            <p className="text-sm text-text-muted">
              Hi {customerName.split(" ")[0]}, pick a time that works for you
              {product ? ` to install your ${product}` : ""}.
            </p>

            {/* Date */}
            <label className="block text-sm font-medium text-foreground mt-6 mb-1.5">Date</label>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />

            {/* Times */}
            <label className="block text-sm font-medium text-foreground mt-5 mb-2">
              Available times
            </label>
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
                        isSel
                          ? "border-primary bg-primary text-white"
                          : "border-border hover:border-primary text-foreground"
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
              disabled={!selected || submitting}
              className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CalendarCheck size={16} strokeWidth={1.8} />}
              {selected ? `Confirm ${fmtTime(selected.start_time)}` : "Pick a time"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
