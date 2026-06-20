"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Wrench,
  Plus,
  Trash2,
  Phone,
  User,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  CalendarPlus,
  Key,
  Check,
} from "lucide-react";

export interface Technician {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface Slot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  booking_id: string | null;
  booking?: { booking_ref: string } | null;
}

/** "12:00:00" / "12:00" → "12:00 PM". */
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

export function TechniciansManager({ initialTechnicians }: { initialTechnicians: Technician[] }) {
  const [technicians, setTechnicians] = useState<Technician[]>(initialTechnicians);
  const [selectedId, setSelectedId] = useState<string | null>(initialTechnicians[0]?.id ?? null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = technicians.find((t) => t.id === selectedId) ?? null;

  async function addTechnician() {
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/technicians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to add");
        return;
      }
      setTechnicians((prev) => [...prev, json.data.technician].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(json.data.technician.id);
      setName("");
      setPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setAdding(false);
    }
  }

  async function deleteTechnician(id: string) {
    if (!confirm("Delete this technician and all their availability?")) return;
    const res = await fetch(`/api/v1/technicians/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTechnicians((prev) => prev.filter((t) => t.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Technician list + add */}
      <Card>
        <CardHeader>
          <CardTitle>Technicians</CardTitle>
          <CardDescription>Your install team</CardDescription>
        </CardHeader>

        <div className="space-y-1 -mx-2">
          {technicians.length === 0 && (
            <p className="px-2 text-sm text-text-muted">No technicians yet. Add one below.</p>
          )}
          {technicians.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                selectedId === t.id ? "bg-primary/10" : "hover:bg-surface"
              }`}
              onClick={() => setSelectedId(t.id)}
            >
              <User size={16} strokeWidth={1.8} className="text-text-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">{t.name}</div>
                {t.phone && <div className="text-[10px] text-text-muted font-mono">{t.phone}</div>}
              </div>
              {!t.is_active && <Badge variant="default">inactive</Badge>}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteTechnician(t.id);
                }}
                className="p-1 rounded hover:bg-error/10 text-text-muted hover:text-error"
                title="Delete"
              >
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <Input
            id="tech_name"
            label="Add technician"
            icon={Wrench}
            placeholder="Name (e.g. Arshad Khan)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="tech_phone"
            icon={Phone}
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {error && (
            <p className="flex items-center gap-1 text-xs text-error">
              <AlertCircle size={12} strokeWidth={1.8} /> {error}
            </p>
          )}
          <Button onClick={addTechnician} loading={adding} disabled={!name.trim()} className="w-full">
            <Plus size={14} strokeWidth={1.8} />
            Add technician
          </Button>
        </div>
      </Card>

      {/* Availability editor */}
      {selected ? (
        <AvailabilityEditor technician={selected} />
      ) : (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Wrench size={28} strokeWidth={1.5} className="text-text-muted mb-3" />
            <p className="text-sm text-text-muted">Select or add a technician to manage their availability.</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function AvailabilityEditor({ technician }: { technician: Technician }) {
  const [date, setDate] = useState(riyadhToday());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [pcState, setPcState] = useState<"idle" | "saving" | "saved">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/technicians/${technician.id}/slots?date=${date}`);
      const json = await res.json();
      if (res.ok && json.success) setSlots(json.data.slots ?? []);
    } finally {
      setLoading(false);
    }
  }, [technician.id, date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addSlot(s: string, e: string) {
    const res = await fetch(`/api/v1/technicians/${technician.id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot_date: date, start_time: s, end_time: e }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message ?? "Failed to add slot");
    }
  }

  async function handleAddOne() {
    setBusy(true);
    setError(null);
    try {
      await addSlot(start, end);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  /** Generates 1-hour slots from `start` to `end` (e.g. 12:00–15:00 → 12-1, 1-2, 2-3). */
  async function handleGenerateHourly() {
    const sh = Number(start.split(":")[0]);
    const eh = Number(end.split(":")[0]);
    if (eh <= sh) {
      setError("End hour must be after start hour for hourly generation.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (let h = sh; h < eh; h++) {
        const s = `${String(h).padStart(2, "0")}:00`;
        const e2 = `${String(h + 1).padStart(2, "0")}:00`;
        try {
          await addSlot(s, e2);
        } catch {
          /* skip duplicates */
        }
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteSlot(id: string) {
    const res = await fetch(`/api/v1/technicians/${technician.id}/slots/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.error?.message ?? "Failed to delete");
      return;
    }
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  async function savePasscode() {
    if (passcode.length < 4) {
      setError("Passcode must be at least 4 characters.");
      return;
    }
    setPcState("saving");
    setError(null);
    const res = await fetch(`/api/v1/technicians/${technician.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.error?.message ?? "Failed to set passcode");
      setPcState("idle");
      return;
    }
    setPasscode("");
    setPcState("saved");
    setTimeout(() => setPcState("idle"), 2500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Wrench size={18} strokeWidth={1.8} />
            {technician.name} — Availability
          </span>
        </CardTitle>
        <CardDescription>Add the time blocks this technician is free. Each slot holds one install.</CardDescription>
      </CardHeader>

      <div className="space-y-5">
        {/* Technician login */}
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <div className="text-sm font-medium text-foreground mb-1">Technician login</div>
          <p className="text-[11px] text-text-muted mb-2">
            They sign in at <span className="font-mono">/tech</span> with their phone
            {technician.phone ? ` (${technician.phone})` : ""} + this passcode.
          </p>
          <div className="flex items-end gap-2 flex-wrap">
            <Input
              id="passcode"
              label="Set / reset passcode"
              type="text"
              icon={Key}
              placeholder="e.g. 4821"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="!w-auto"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={savePasscode}
              loading={pcState === "saving"}
              disabled={!passcode}
            >
              {pcState === "saved" ? <Check size={14} strokeWidth={1.8} /> : <Key size={14} strokeWidth={1.8} />}
              {pcState === "saved" ? "Saved" : "Save passcode"}
            </Button>
          </div>
          {!technician.phone && (
            <p className="text-[11px] text-warning mt-1.5">
              Add a phone number to this technician so they can log in.
            </p>
          )}
        </div>

        {/* Date picker */}
        <div className="max-w-xs">
          <Input
            id="slot_date"
            label="Date"
            type="date"
            icon={Calendar}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Slot list */}
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-text-muted">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-text-muted py-2">No availability set for this day.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => {
                const booked = Boolean(s.booking_id);
                return (
                  <div
                    key={s.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
                      booked
                        ? "border-warning/30 bg-warning/10 text-warning"
                        : "border-success/30 bg-success/10 text-success"
                    }`}
                  >
                    <Clock size={12} strokeWidth={1.8} />
                    {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                    {booked ? (
                      <span className="font-medium">· {s.booking?.booking_ref ?? "booked"}</span>
                    ) : (
                      <button
                        onClick={() => deleteSlot(s.id)}
                        className="ml-0.5 hover:text-error"
                        title="Remove slot"
                      >
                        <Trash2 size={12} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add slots */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              id="start_time"
              label="From"
              type="time"
              icon={Clock}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="!w-auto"
            />
            <Input
              id="end_time"
              label="To"
              type="time"
              icon={Clock}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="!w-auto"
            />
            <Button variant="secondary" size="sm" onClick={handleAddOne} loading={busy}>
              <Plus size={14} strokeWidth={1.8} />
              Add slot
            </Button>
            <Button variant="ghost" size="sm" onClick={handleGenerateHourly} disabled={busy}>
              <CalendarPlus size={14} strokeWidth={1.8} />
              Generate hourly
            </Button>
          </div>
          <p className="text-[11px] text-text-muted">
            &ldquo;Generate hourly&rdquo; creates one-hour slots across the From–To range (e.g. 12:00–15:00 → 12–1, 1–2, 2–3).
          </p>
          {error && (
            <p className="flex items-center gap-1 text-xs text-error">
              <AlertCircle size={12} strokeWidth={1.8} /> {error}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
