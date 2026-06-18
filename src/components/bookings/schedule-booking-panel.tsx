"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultPriceForModel } from "@/lib/products";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CalendarCheck,
  Calendar,
  Clock,
  Wrench,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  Send,
  Loader2,
} from "lucide-react";

interface TechnicianOption {
  id: string;
  name: string;
}

interface ScheduleBookingPanelProps {
  leadId: string;
  hasPhone: boolean;
  productModel: string | null;
  productQty: number;
  /** Current lead status — used to show whether a booking already exists. */
  leadStatus: string;
  /** The lead's active booking, if any — editing it instead of creating new. */
  existingBooking: ExistingBooking | null;
  /** Linked chat channel + conversation, for sending the confirmation inline. */
  chatChannel: "whatsapp" | "messenger" | null;
  chatConversationId: string | null;
  /** The user's technicians, for assigning the install + slot. */
  technicians: TechnicianOption[];
}

export interface ExistingBooking {
  id: string;
  booking_ref: string;
  scheduled_at: string;
  slot_label: string | null;
  unit_price: number | null;
  technician: string | null;
  notes: string | null;
  status: string;
  technician_id: string | null;
  slot_id: string | null;
}

interface SlotOption {
  id: string;
  start_time: string;
  end_time: string;
  booking_id: string | null;
}

/** "12:00:00" → "12:00 PM". */
function fmtTime(t: string): string {
  const [h, m] = t.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${ampm}`;
}

/** Today's date in Riyadh as YYYY-MM-DD. */
function riyadhToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Result =
  | { kind: "saved"; verb: "created" | "updated"; bookingRef: string; text: string; autoSent: boolean }
  | { kind: "error"; message: string };

/** Splits an ISO timestamp into Riyadh-local date (YYYY-MM-DD) and time (HH:mm). */
function riyadhDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { date, time };
}

/**
 * "Schedule Installation" panel on the lead detail page. Collects the install
 * date/time + price, creates a booking via POST /api/v1/bookings, and reports
 * whether the WhatsApp confirmation was delivered (free-text vs template).
 */
export function ScheduleBookingPanel({
  leadId,
  hasPhone,
  productModel,
  productQty,
  leadStatus,
  existingBooking,
  chatChannel,
  chatConversationId,
  technicians,
}: ScheduleBookingPanelProps) {
  const router = useRouter();
  const isUpdate = Boolean(existingBooking);
  const initialDate = existingBooking
    ? riyadhDateTimeParts(existingBooking.scheduled_at).date
    : riyadhToday();

  const [technicianId, setTechnicianId] = useState(
    existingBooking?.technician_id ?? technicians[0]?.id ?? ""
  );
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(existingBooking?.slot_id ?? null);
  const [notes, setNotes] = useState(existingBooking?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [chatSend, setChatSend] = useState<{
    state: "idle" | "sending" | "sent" | "error";
    message?: string;
  }>({ state: "idle" });

  const canSendInChat = Boolean(chatChannel && chatConversationId);
  const channelLabel = chatChannel === "messenger" ? "Messenger" : "WhatsApp";

  // Load the chosen technician's slots for the chosen date.
  const loadSlots = useCallback(async () => {
    if (!technicianId || !date) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/v1/technicians/${technicianId}/slots?date=${date}`);
      const json = await res.json();
      setSlots(res.ok && json.success ? (json.data.slots as SlotOption[]) : []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [technicianId, date]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // A slot is selectable if it's free, or it's the one this booking already holds.
  const isSelectable = (s: SlotOption) =>
    s.booking_id === null || (isUpdate && s.booking_id === existingBooking!.id);
  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null;

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  /** Sends the confirmation text straight into the customer's chat thread. */
  async function sendInChat(text: string) {
    if (!canSendInChat) return;
    setChatSend({ state: "sending" });
    try {
      const res = await fetch(
        `/api/v1/${chatChannel}/conversations/${chatConversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setChatSend({ state: "error", message: json.error?.message ?? "Failed to send" });
        return;
      }
      setChatSend({ state: "sent" });
    } catch (err) {
      setChatSend({ state: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  const qty = productQty || 1;
  // Price comes from the selected model's catalog price (kept on the booking +
  // confirmation); there's no manual price entry on this panel.
  const priceNum = existingBooking?.unit_price ?? defaultPriceForModel(productModel);
  const total = priceNum != null ? priceNum * qty : null;
  const alreadyBooked = leadStatus === "scheduled" || leadStatus === "installed";

  async function handleSubmit() {
    setResult(null);
    setChatSend({ state: "idle" });

    if (!hasPhone) {
      setResult({ kind: "error", message: "This lead has no phone number — add one first." });
      return;
    }
    if (!technicianId) {
      setResult({ kind: "error", message: "Pick a technician." });
      return;
    }
    if (!selectedSlot) {
      setResult({ kind: "error", message: "Pick an available slot." });
      return;
    }

    // Saudi Arabia is UTC+3 year-round (no DST). Slot start → explicit-offset ISO.
    const scheduledAt = `${date}T${selectedSlot.start_time}+03:00`;
    const slotLabel = `${fmtTime(selectedSlot.start_time)}–${fmtTime(selectedSlot.end_time)}`;
    const technicianName = technicians.find((t) => t.id === technicianId)?.name ?? null;

    setSubmitting(true);
    try {
      const url = isUpdate ? `/api/v1/bookings/${existingBooking!.id}` : "/api/v1/bookings";
      const method = isUpdate ? "PATCH" : "POST";
      const common = {
        scheduled_at: scheduledAt,
        slot_label: slotLabel,
        unit_price: priceNum,
        technician: technicianName,
        technician_id: technicianId,
        slot_id: selectedSlot.id,
        notes: notes.trim() || null,
      };
      const body = isUpdate ? common : { lead_id: leadId, ...common };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setResult({ kind: "error", message: json.error?.message ?? "Booking failed" });
        return;
      }

      setResult({
        kind: "saved",
        verb: isUpdate ? "updated" : "created",
        bookingRef: json.data.booking?.booking_ref ?? "—",
        text: json.data.confirmation_text ?? "",
        autoSent: Boolean(json.data.confirmation_sent),
      });
      router.refresh();
    } catch (err) {
      setResult({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <CalendarCheck size={18} strokeWidth={1.8} />
                {isUpdate ? "Update Booking" : "Schedule Installation"}
              </span>
            </CardTitle>
            <CardDescription>
              {isUpdate
                ? "This lead already has a booking — saving updates it (no duplicate is created)."
                : "Confirm the install date & time. A ready-to-send confirmation message is generated for you to copy into WhatsApp."}
            </CardDescription>
          </div>
          {isUpdate ? (
            <Badge variant="processing">{existingBooking!.booking_ref}</Badge>
          ) : (
            alreadyBooked && <Badge variant="success">Already booked</Badge>
          )}
        </div>
      </CardHeader>

      <div className="space-y-4">
        {technicians.length === 0 ? (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            No technicians yet. Add one in the <strong>Technicians</strong> tab, then set their
            availability, to schedule installs.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Technician *</label>
                <div className="relative">
                  <Wrench
                    size={16}
                    strokeWidth={1.8}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <select
                    value={technicianId}
                    onChange={(e) => {
                      setTechnicianId(e.target.value);
                      setSelectedSlotId(null);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                id="booking_date"
                label="Installation date *"
                type="date"
                icon={Calendar}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSelectedSlotId(null);
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Available slots *
              </label>
              {slotsLoading ? (
                <div className="flex items-center gap-2 text-text-muted text-sm py-2">
                  <Loader2 size={16} className="animate-spin" /> Loading slots…
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-text-muted py-1">
                  No slots for this day. Add availability in the{" "}
                  <strong className="text-foreground">Technicians</strong> tab.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => {
                    const selectable = isSelectable(s);
                    const selected = s.id === selectedSlotId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!selectable}
                        onClick={() => setSelectedSlotId(s.id)}
                        title={selectable ? "" : "Already booked"}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                          selected
                            ? "border-primary bg-primary text-white"
                            : selectable
                              ? "border-border hover:border-primary text-foreground"
                              : "border-border bg-surface text-text-muted opacity-60 cursor-not-allowed line-through"
                        }`}
                      >
                        <Clock size={12} strokeWidth={1.8} />
                        {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Order summary preview */}
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-muted">
          <div className="flex justify-between">
            <span>{productModel ?? "Water purifier"} × {qty}</span>
            <span className="text-foreground font-medium">
              {total !== null ? `SAR ${total.toLocaleString("en-US")}` : "—"}
            </span>
          </div>
        </div>

        <Textarea
          id="booking_notes"
          label="Internal notes (not sent to customer)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {result?.kind === "saved" && (
          <div className="space-y-2 rounded-lg border border-success/30 bg-success/5 p-4">
            <div className="flex items-start gap-2 text-sm text-success">
              <CheckCircle size={15} strokeWidth={1.8} className="mt-0.5 shrink-0" />
              <span>
                Booking <strong>{result.bookingRef}</strong> {result.verb}.
                {result.autoSent
                  ? " WhatsApp confirmation sent automatically."
                  : canSendInChat
                    ? ` Send it on ${channelLabel} below, or copy it.`
                    : " Copy the message below and send it to the customer on WhatsApp."}
              </span>
            </div>
            {!result.autoSent && (
              <>
                <Textarea
                  id="confirmation_text"
                  label="Message to send"
                  rows={9}
                  readOnly
                  value={result.text}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {canSendInChat && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => sendInChat(result.text)}
                      loading={chatSend.state === "sending"}
                      disabled={chatSend.state === "sent"}
                    >
                      {chatSend.state === "sent" ? (
                        <Check size={14} strokeWidth={1.8} />
                      ) : (
                        <Send size={14} strokeWidth={1.8} />
                      )}
                      {chatSend.state === "sent" ? "Sent" : `Send on ${channelLabel}`}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copyMessage(result.text)}
                  >
                    {copied ? (
                      <Check size={14} strokeWidth={1.8} />
                    ) : (
                      <Copy size={14} strokeWidth={1.8} />
                    )}
                    {copied ? "Copied!" : "Copy message"}
                  </Button>
                </div>
                {chatSend.state === "sent" && (
                  <p className="text-xs text-success">
                    Sent to the customer on {channelLabel}. ✓
                  </p>
                )}
                {chatSend.state === "error" && (
                  <p className="text-xs text-error">
                    Couldn&apos;t send: {chatSend.message}
                    {" "}(the 24h window may be closed — copy &amp; send manually).
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {result?.kind === "error" && (
          <div className="flex items-start gap-2 text-sm text-error">
            <AlertCircle size={15} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <span>{result.message}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          {!hasPhone && (
            <span className="text-xs text-text-muted">Add a phone number to enable booking.</span>
          )}
          <div className="flex-1" />
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!hasPhone || !selectedSlotId}
          >
            <CalendarCheck size={14} strokeWidth={1.8} />
            {isUpdate ? "Update Booking" : "Create Booking"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
