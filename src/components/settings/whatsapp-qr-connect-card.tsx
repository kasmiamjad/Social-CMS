"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, CheckCircle, Loader2, Unlink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ConnectionStatus {
  status: "disconnected" | "qr_pending" | "connected";
  qr_code: string | null;
  connected_number: string | null;
  last_connected_at: string | null;
}

const POLL_INTERVAL_MS = 3000;

/**
 * Replaces WhatsApp's old token-paste credentials card — instead of pasting
 * Meta Cloud API tokens, this links the business number the way WhatsApp Web
 * does: scan a QR code once from the phone (WhatsApp → Linked Devices → Link
 * a Device). Polls /api/v1/whatsapp/connection-status for the live QR and
 * connection state, since the actual link happens on the server's persistent
 * Baileys socket, not in this browser tab.
 */
export function WhatsAppQrConnectCard() {
  const [state, setState] = useState<ConnectionStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/v1/whatsapp/connection-status");
        const json = await res.json();
        if (!cancelled && json.success) {
          setState(json.data as ConnectionStatus);
        }
      } catch {
        // Transient network hiccup — just retry on the next tick.
      }
      if (!cancelled) {
        timeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleDisconnect(): Promise<void> {
    setDisconnecting(true);
    try {
      await fetch("/api/v1/whatsapp/disconnect", { method: "POST" });
    } finally {
      setDisconnecting(false);
    }
  }

  const status = state?.status ?? "disconnected";

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
              <MessageCircle size={20} strokeWidth={1.8} className="text-foreground" />
            </div>
            <div>
              <CardTitle>WhatsApp</CardTitle>
              <CardDescription>AI auto-reply to customer WhatsApp messages</CardDescription>
            </div>
          </div>
          {status === "connected" ? (
            <Badge variant="success" className="whitespace-nowrap">Connected</Badge>
          ) : status === "qr_pending" ? (
            <Badge variant="processing" className="whitespace-nowrap">Scan QR</Badge>
          ) : (
            <Badge variant="default" className="whitespace-nowrap">Not connected</Badge>
          )}
        </div>
      </CardHeader>

      {status === "connected" ? (
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <CheckCircle size={32} strokeWidth={1.8} className="text-success" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Connected as {state?.connected_number ? `+${state.connected_number}` : "linked device"}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Messages sent from this number sync with the CRM automatically.
            </p>
          </div>
          <Button variant="secondary" onClick={handleDisconnect} loading={disconnecting} className="mt-1">
            <Unlink size={14} strokeWidth={1.8} />
            Disconnect
          </Button>
        </div>
      ) : status === "qr_pending" && state?.qr_code ? (
        <div className="flex flex-col items-center text-center gap-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.qr_code}
            alt="WhatsApp QR code"
            className="w-48 h-48 rounded-lg border border-border bg-white p-2"
          />
          <p className="text-xs text-text-muted max-w-xs">
            On the business phone: WhatsApp → Settings → Linked Devices → Link a Device, then scan
            this code.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center gap-2 py-6">
          <Loader2 size={20} strokeWidth={1.8} className="animate-spin text-text-muted" />
          <p className="text-xs text-text-muted">Waiting for a QR code from the server…</p>
        </div>
      )}
    </Card>
  );
}
