"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, AlertCircle, Bot, Clock } from "lucide-react";

export interface WhatsAppAutomationConfig {
  enabled: boolean;
  auto_reply: boolean;
  system_prompt: string;
  signature_suffix: string;
  business_hours_enabled: boolean;
  business_hours_start: string | null;
  business_hours_end: string | null;
  business_hours_timezone: string | null;
  out_of_hours_message: string | null;
}

interface AutomationConfigFormProps {
  initialConfig: WhatsAppAutomationConfig;
}

export function AutomationConfigForm({ initialConfig }: AutomationConfigFormProps) {
  const [config, setConfig] = useState<WhatsAppAutomationConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  function update<K extends keyof WhatsAppAutomationConfig>(key: K, value: WhatsAppAutomationConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    if (status) setStatus(null);
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);

    try {
      const res = await fetch("/api/v1/whatsapp/automation-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setStatus({ type: "error", message: json.error?.message ?? "Save failed" });
      } else {
        setStatus({ type: "success", message: "Automation settings saved." });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
            <Bot size={20} strokeWidth={1.8} className="text-foreground" />
          </div>
          <div>
            <CardTitle>AI Auto-Reply Configuration</CardTitle>
            <CardDescription>
              Define how the AI responds to incoming WhatsApp messages
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="space-y-5">
        {/* Master toggles */}
        <div className="space-y-3">
          <ToggleRow
            label="Enable WhatsApp automation"
            description="Master switch. Turn off to disable all automation features."
            checked={config.enabled}
            onChange={(v) => update("enabled", v)}
          />
          <ToggleRow
            label="Auto-send AI replies"
            description="When ON, AI replies are sent immediately. When OFF, replies are generated and stored but not sent."
            checked={config.auto_reply}
            onChange={(v) => update("auto_reply", v)}
            disabled={!config.enabled}
          />
        </div>

        {/* System prompt */}
        <Textarea
          id="wa-system-prompt"
          label="AI system prompt"
          rows={12}
          value={config.system_prompt}
          onChange={(e) => update("system_prompt", e.target.value)}
          charCount={{ current: config.system_prompt.length, max: 20000 }}
        />
        <p className="-mt-3 text-xs text-text-muted">
          Customize the AI&apos;s voice and rules. The system enforces JSON output automatically.
        </p>

        {/* Signature */}
        <Input
          id="wa-signature"
          label="Reply signature (optional)"
          placeholder="e.g. — Sent by Social-CMS AI"
          value={config.signature_suffix ?? ""}
          onChange={(e) => update("signature_suffix", e.target.value)}
        />
        <p className="-mt-3 text-xs text-text-muted">
          Appended to every AI reply on a new line. Leave blank to omit.
        </p>

        {/* Business hours */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2 text-foreground font-medium text-sm">
            <Clock size={16} strokeWidth={1.8} />
            Business hours
          </div>

          <ToggleRow
            label="Limit auto-replies to business hours"
            description="Outside business hours, send the out-of-hours message instead of an AI reply."
            checked={config.business_hours_enabled}
            onChange={(v) => update("business_hours_enabled", v)}
            disabled={!config.enabled}
          />

          {config.business_hours_enabled && (
            <div className="grid grid-cols-2 gap-3 pl-4">
              <Input
                id="wa-bh-start"
                label="Start (HH:MM)"
                placeholder="09:00"
                value={config.business_hours_start ?? ""}
                onChange={(e) => update("business_hours_start", e.target.value || null)}
              />
              <Input
                id="wa-bh-end"
                label="End (HH:MM)"
                placeholder="18:00"
                value={config.business_hours_end ?? ""}
                onChange={(e) => update("business_hours_end", e.target.value || null)}
              />
              <div className="col-span-2">
                <Input
                  id="wa-bh-tz"
                  label="Timezone (IANA)"
                  placeholder="UTC, America/New_York, Asia/Riyadh, ..."
                  value={config.business_hours_timezone ?? "UTC"}
                  onChange={(e) => update("business_hours_timezone", e.target.value || null)}
                />
              </div>
              <div className="col-span-2">
                <Textarea
                  id="wa-out-of-hours"
                  label="Out-of-hours message"
                  placeholder="Thanks for messaging! We'll respond during business hours (09:00-18:00 UTC)."
                  rows={3}
                  value={config.out_of_hours_message ?? ""}
                  onChange={(e) => update("out_of_hours_message", e.target.value || null)}
                  charCount={{ current: (config.out_of_hours_message ?? "").length, max: 4096 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status feedback */}
        {status && (
          <div
            className={`flex items-center gap-2 text-sm ${
              status.type === "success" ? "text-success" : "text-error"
            }`}
          >
            {status.type === "success" ? (
              <CheckCircle size={14} strokeWidth={1.8} />
            ) : (
              <AlertCircle size={14} strokeWidth={1.8} />
            )}
            {status.message}
          </div>
        )}

        <Button onClick={handleSave} loading={saving}>
          Save Automation Settings
        </Button>
      </div>
    </Card>
  );
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <label
      className={`flex items-start justify-between gap-4 cursor-pointer rounded-lg border border-border px-3 py-2.5 ${
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-surface"
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && (
          <div className="text-xs text-text-muted mt-0.5">{description}</div>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
      />
    </label>
  );
}
