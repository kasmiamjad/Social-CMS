"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  AlertTriangle,
} from "lucide-react";

interface ScheduleBookingPanelProps {
  leadId: string;
  hasPhone: boolean;
  productModel: string | null;
  productQty: number;
  defaultTechnician: string | null;
  /** Current lead status — used to show whether a booking already exists. */
  leadStatus: string;
}

type Result =
  | { kind: "success"; bookingRef: string; deliveryMethod: string | null }
  | { kind: "partial"; bookingRef: string; error: string }
  | { kind: "error"; message: string };

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
}: ScheduleBookingPanelProps) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slotLabel, setSlotLabel] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [technician, setTechnician] = useState(defaultTechnician ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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
      const res = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          scheduled_at: scheduledAt,
          slot_label: slotLabel.trim() || null,
          unit_price: priceNum,
          technician: technician.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setResult({ kind: "error", message: json.error?.message ?? "Booking failed" });
        return;
      }

      const ref = json.data.booking?.booking_ref ?? "—";
      if (json.data.confirmation_sent) {
        setResult({ kind: "success", bookingRef: ref, deliveryMethod: json.data.delivery_method });
      } else {
        setResult({
          kind: "partial",
          bookingRef: ref,
          error: json.data.confirmation_error ?? "WhatsApp confirmation was not delivered.",
        });
      }
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
                Schedule Installation
              </span>
            </CardTitle>
            <CardDescription>
              Confirm the install date &amp; time. A WhatsApp confirmation with the order
              details is sent to the customer automatically.
            </CardDescription>
          </div>
          {alreadyBooked && <Badge variant="success">Already booked</Badge>}
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

        {result?.kind === "success" && (
          <div className="flex items-start gap-2 text-sm text-success">
            <CheckCircle size={15} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <span>
              Booking <strong>{result.bookingRef}</strong> created. WhatsApp confirmation sent
              {result.deliveryMethod === "template" ? " (template)" : " (free text)"}.
            </span>
          </div>
        )}
        {result?.kind === "partial" && (
          <div className="flex items-start gap-2 text-sm text-warning">
            <AlertTriangle size={15} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <span>
              Booking <strong>{result.bookingRef}</strong> created, but the WhatsApp confirmation
              failed: {result.error}
            </span>
          </div>
        )}
        {result?.kind === "error" && (
          <div className="flex items-start gap-2 text-sm text-error">
            <AlertCircle size={15} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <span>{result.error}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          {!hasPhone && (
            <span className="text-xs text-text-muted">Add a phone number to enable booking.</span>
          )}
          <div className="flex-1" />
          <Button onClick={handleSubmit} loading={submitting} disabled={!hasPhone}>
            <CalendarCheck size={14} strokeWidth={1.8} />
            Confirm &amp; Send WhatsApp
          </Button>
        </div>
      </div>
    </Card>
  );
}
