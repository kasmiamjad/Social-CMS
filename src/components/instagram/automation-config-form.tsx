"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, AlertCircle, Bot, Clock, MessageCircle, MessageSquare } from "lucide-react";

export interface InstagramAutomationConfig {
  enabled: boolean;
  dms_enabled: boolean;
  dms_auto_reply: boolean;
  dms_system_prompt: string;
  comments_enabled: boolean;
  comments_auto_reply: boolean;
  comments_system_prompt: string;
  signature_suffix: string;
  business_hours_enabled: boolean;
  business_hours_start: string | null;
  business_hours_end: string | null;
  business_hours_timezone: string | null;
  out_of_hours_message: string | null;
}

interface InstagramAutomationConfigFormProps {
  initialConfig: InstagramAutomationConfig;
}

export function InstagramAutomationConfigForm({ initialConfig }: InstagramAutomationConfigFormProps) {
  const [config, setConfig] = useState<InstagramAutomationConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function update<K extends keyof InstagramAutomationConfig>(key: K, value: InstagramAutomationConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    if (status) setStatus(null);
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/v1/instagram/automation-config", {
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
            <CardTitle>Instagram AI Configuration</CardTitle>
            <CardDescription>
              Auto-reply to DMs and comments using OpenAI
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="space-y-5">
        {/* Master switch */}
        <ToggleRow
          label="Enable Instagram automation"
          description="Master switch — when off, neither DM nor comment auto-replies will run."
          checked={config.enabled}
          onChange={(v) => update("enabled", v)}
          variant="master"
        />

        {/* DM channel */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageCircle size={15} strokeWidth={1.8} />
            Direct Messages (DMs)
          </div>
          <ToggleRow
            label="Enable DM automation"
            description="Track and store incoming DMs."
            checked={config.dms_enabled}
            onChange={(v) => update("dms_enabled", v)}
            disabled={!config.enabled}
          />
          <ToggleRow
            label="Auto-send AI replies to DMs"
            description="If off, AI generates replies but doesn't send them automatically."
            checked={config.dms_auto_reply}
            onChange={(v) => update("dms_auto_reply", v)}
            disabled={!config.enabled || !config.dms_enabled}
          />
          <Textarea
            id="ig-dms-prompt"
            label="DM system prompt"
            rows={8}
            value={config.dms_system_prompt}
            onChange={(e) => update("dms_system_prompt", e.target.value)}
            charCount={{ current: config.dms_system_prompt.length, max: 20000 }}
          />
        </div>

        {/* Comments channel */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquare size={15} strokeWidth={1.8} />
            Comments
          </div>
          <ToggleRow
            label="Enable comment automation"
            description="Track and store incoming comments on your posts."
            checked={config.comments_enabled}
            onChange={(v) => update("comments_enabled", v)}
            disabled={!config.enabled}
          />
          <ToggleRow
            label="Auto-reply to comments"
            description="If off, AI generates replies but they wait for manual approval."
            checked={config.comments_auto_reply}
            onChange={(v) => update("comments_auto_reply", v)}
            disabled={!config.enabled || !config.comments_enabled}
          />
          <Textarea
            id="ig-comments-prompt"
            label="Comment system prompt"
            rows={8}
            value={config.comments_system_prompt}
            onChange={(e) => update("comments_system_prompt", e.target.value)}
            charCount={{ current: config.comments_system_prompt.length, max: 20000 }}
          />
        </div>

        {/* Shared signature */}
        <Input
          id="ig-signature"
          label="Reply signature (optional)"
          placeholder="e.g. — Sent via Social-CMS"
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
            description="Outside business hours, send the out-of-hours message instead."
            checked={config.business_hours_enabled}
            onChange={(v) => update("business_hours_enabled", v)}
            disabled={!config.enabled}
          />
          {config.business_hours_enabled && (
            <div className="grid grid-cols-2 gap-3 pl-4">
              <Input
                id="ig-bh-start"
                label="Start (HH:MM)"
                placeholder="09:00"
                value={config.business_hours_start ?? ""}
                onChange={(e) => update("business_hours_start", e.target.value || null)}
              />
              <Input
                id="ig-bh-end"
                label="End (HH:MM)"
                placeholder="22:00"
                value={config.business_hours_end ?? ""}
                onChange={(e) => update("business_hours_end", e.target.value || null)}
              />
              <div className="col-span-2">
                <Input
                  id="ig-bh-tz"
                  label="Timezone (IANA)"
                  placeholder="Asia/Riyadh, UTC, America/New_York…"
                  value={config.business_hours_timezone ?? "UTC"}
                  onChange={(e) => update("business_hours_timezone", e.target.value || null)}
                />
              </div>
              <div className="col-span-2">
                <Textarea
                  id="ig-out-of-hours"
                  label="Out-of-hours message"
                  placeholder="Thanks for messaging! We'll respond during business hours."
                  rows={3}
                  value={config.out_of_hours_message ?? ""}
                  onChange={(e) => update("out_of_hours_message", e.target.value || null)}
                />
              </div>
            </div>
          )}
        </div>

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
  variant?: "master" | "default";
}

function ToggleRow({ label, description, checked, onChange, disabled, variant }: ToggleRowProps) {
  return (
    <label
      className={`flex items-start justify-between gap-4 cursor-pointer rounded-lg border ${
        variant === "master" ? "border-primary/30 bg-primary/5" : "border-border"
      } px-3 py-2.5 ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-surface"}`}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-xs text-text-muted mt-0.5">{description}</div>}
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
