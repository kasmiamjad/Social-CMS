"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, AlertCircle, type LucideIcon } from "lucide-react";

export interface ManualCredentialField {
  /** Object key used to store the value in the credentials JSONB. */
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password";
  icon: LucideIcon;
  helpText: string;
  /** If true, the field must be filled before saving. Defaults to true. */
  required?: boolean;
}

export interface ManualSetupStep {
  title: string;
  detail: string;
}

export interface ManualPlatformDefinition {
  /** Lowercase platform slug (e.g. "instagram"). */
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  fields: ManualCredentialField[];
  setupGuide: ManualSetupStep[];
}

interface ManualCredentialsCardProps {
  platform: ManualPlatformDefinition;
  /** Currently saved credentials for this platform. Password-type fields are stripped to empty. */
  initialCredentials: Record<string, string>;
  /** Names of password-type fields that have a saved value in the DB (but were stripped before reaching the client). */
  savedSecretKeys?: string[];
  /** Whether a credential row already exists in the DB for this platform. */
  isConnected: boolean;
}

/**
 * Settings card for platforms that use manual long-lived token entry rather
 * than a full OAuth redirect flow (currently Instagram).
 *
 * Extracts and generalizes the credential form logic that previously lived
 * inline inside PlatformCredentialsForm.
 */
export function ManualCredentialsCard({
  platform,
  initialCredentials,
  savedSecretKeys = [],
  isConnected,
}: ManualCredentialsCardProps) {
  const savedSecrets = new Set(savedSecretKeys);
  const [credentials, setCredentials] = useState<Record<string, string>>(
    () => ({ ...initialCredentials })
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const supabase = createClient();

  function updateField(key: string, value: string): void {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    if (status) setStatus(null);
  }

  async function handleSave(): Promise<void> {
    // Validation: required fields must either be filled in the form OR already
    // saved as a secret in the DB. We accept empty password fields when a
    // saved value exists (because we'll merge with the existing JSONB).
    const missingField = platform.fields
      .filter((f) => f.required !== false)
      .find((f) => {
        const hasNewValue = Boolean(credentials[f.key]?.trim());
        const hasSavedSecret = savedSecrets.has(f.key);
        return !hasNewValue && !hasSavedSecret;
      });

    if (missingField) {
      setStatus({
        type: "error",
        message: `Field "${missingField.label}" is required.`,
      });
      return;
    }

    setSaving(true);
    setStatus(null);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSaving(false);
      setStatus({
        type: "error",
        message: "Your session could not be verified. Refresh the page and sign in again.",
      });
      return;
    }

    // Fetch the existing credentials row so we can MERGE — never blow away
    // a saved secret just because the user didn't retype it.
    const { data: existingRow } = await supabase
      .from("platform_credentials")
      .select("credentials")
      .eq("user_id", user.id)
      .eq("platform", platform.id)
      .maybeSingle<{ credentials: Record<string, string> | null }>();

    const existingCreds: Record<string, string> = existingRow?.credentials ?? {};
    const mergedCreds: Record<string, string> = { ...existingCreds };

    // Override existing values only with non-empty new values
    for (const [key, value] of Object.entries(credentials)) {
      if (value && value.trim()) {
        mergedCreds[key] = value.trim();
      }
    }

    const { error } = await supabase.from("platform_credentials").upsert(
      {
        user_id: user.id,
        platform: platform.id,
        credentials: mergedCreds,
        is_active: true,
      },
      { onConflict: "user_id,platform" }
    );

    setSaving(false);

    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      // Clear the form's password fields after a successful save so the next
      // edit doesn't accidentally overwrite anything.
      setCredentials((prev) => {
        const next = { ...prev };
        for (const field of platform.fields) {
          if (field.type === "password") next[field.key] = "";
        }
        return next;
      });
      setStatus({ type: "success", message: "Credentials saved successfully." });
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
              <platform.icon size={20} strokeWidth={1.8} className="text-foreground" />
            </div>
            <div>
              <CardTitle>{platform.name}</CardTitle>
              <CardDescription>{platform.description}</CardDescription>
            </div>
          </div>
          {isConnected ? (
            <Badge variant="success" className="whitespace-nowrap">Connected</Badge>
          ) : (
            <Badge variant="default" className="whitespace-nowrap">Not connected</Badge>
          )}
        </div>
      </CardHeader>

      <div className="space-y-4">
        {/* Setup guide */}
        <details className="rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            How to get these credentials
          </summary>
          <ol className="mt-2 space-y-2 text-sm text-text-muted list-decimal list-inside">
            {platform.setupGuide.map((step) => (
              <li key={step.title}>
                <span className="text-foreground font-medium">{step.title}:</span>{" "}
                {step.detail}
              </li>
            ))}
          </ol>
        </details>

        {/* Credential fields */}
        {platform.fields.map((field) => {
          const hasSavedSecret = field.type === "password" && savedSecrets.has(field.key);
          return (
            <div key={field.key}>
              <Input
                id={`${platform.id}-${field.key}`}
                label={field.label}
                type={field.type}
                placeholder={hasSavedSecret ? "•••••• (saved — leave blank to keep)" : field.placeholder}
                icon={field.icon}
                value={credentials[field.key] ?? ""}
                onChange={(e) => updateField(field.key, e.target.value)}
              />
              <p className="mt-1 text-xs text-text-muted">
                {field.helpText}
                {hasSavedSecret && (
                  <span className="block mt-0.5 text-success">
                    ✓ A value is already saved. Type a new one only if you want to replace it.
                  </span>
                )}
              </p>
            </div>
          );
        })}

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
          {isConnected ? "Update Credentials" : "Save Credentials"}
        </Button>
      </div>
    </Card>
  );
}
