"use client";

import { useState } from "react";
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
  DollarSign,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

interface ScheduleBookingPanelProps {
  leadId: string;
  hasPhone: boolean;
  productModel: string | null;
  productQty: number;
  defaultTechnician: string | null;
  /** Current lead status — used to show whether a booking already exists. */
  leadStatus: string;
  /** The lead's active booking, if any — editing it instead of creating new. */
  existingBooking: ExistingBooking | null;
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
  defaultTechnician,
  leadStatus,
  existingBooking,
}: ScheduleBookingPanelProps) {
  const router = useRouter();
  const isUpdate = Boolean(existingBooking);
  const initial = existingBooking
    ? riyadhDateTimeParts(existingBooking.scheduled_at)
    : { date: "", time: "" };

  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [slotLabel, setSlotLabel] = useState(existingBooking?.slot_label ?? "");
  // Update mode keeps the booking's saved price; create mode prefills from the
  // selected model's catalog price (operator can still override).
  const prefillPrice = existingBooking?.unit_price ?? defaultPriceForModel(productModel);
  const [unitPrice, setUnitPrice] = useState(prefillPrice != null ? String(prefillPrice) : "");
  const [technician, setTechnician] = useState(
    existingBooking?.technician ?? defaultTechnician ?? ""
  );
  const [notes, setNotes] = useState(existingBooking?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const qty = productQty || 1;
  const priceNum = unitPrice === "" ? null : Number(unitPrice);
  const total = priceNum !== null && !Number.isNaN(priceNum) ? priceNum * qty : null;
  const alreadyBooked = leadStatus === "scheduled" || leadStatus === "installed";

  async function handleSubmit() {
    setResult(null);

    if (!hasPhone) {
      setResult({ kind: "error", message: "This lead has no phone number — add one first." });
      return;
    }
    if (!date || !time) {
      setResult({ kind: "error", message: "Pick both a date and a time." });
      return;
    }

    // Saudi Arabia is UTC+3 year-round (no DST). Build an explicit-offset ISO string.
    const scheduledAt = `${date}T${time}:00+03:00`;

    setSubmitting(true);
    try {
      const url = isUpdate ? `/api/v1/bookings/${existingBooking!.id}` : "/api/v1/bookings";
      const method = isUpdate ? "PATCH" : "POST";
      const body = isUpdate
        ? {
            scheduled_at: scheduledAt,
            slot_label: slotLabel.trim() || null,
            unit_price: priceNum,
            technician: technician.trim() || null,
            notes: notes.trim() || null,
          }
        : {
            lead_id: leadId,
            scheduled_at: scheduledAt,
            slot_label: slotLabel.trim() || null,
            unit_price: priceNum,
            technician: technician.trim() || null,
            notes: notes.trim() || null,
          };

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="booking_date"
            label="Installation date *"
            type="date"
            icon={Calendar}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            id="booking_time"
            label="Installation time *"
            type="time"
            icon={Clock}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <Input
          id="slot_label"
          label="Slot label (optional — shown to customer instead of exact time)"
          icon={Clock}
          placeholder="e.g. Morning (9 AM – 12 PM)"
          value={slotLabel}
          onChange={(e) => setSlotLabel(e.target.value)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="unit_price"
            label="Unit price (SAR)"
            type="number"
            min={0}
            icon={DollarSign}
            placeholder="e.g. 699"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          <Input
            id="technician"
            label="Technician"
            icon={Wrench}
            placeholder="e.g. ARSHAD KHAN"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
          />
        </div>

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
          <Button onClick={handleSubmit} loading={submitting} disabled={!hasPhone}>
            <CalendarCheck size={14} strokeWidth={1.8} />
            {isUpdate ? "Update Booking" : "Create Booking"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
