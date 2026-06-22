"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

/** Converts a base64url VAPID key to the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "unsupported" | "loading" | "default" | "granted" | "denied" | "working";

/**
 * Header control to enable/disable Web Push for this technician. Hidden when the
 * browser can't do push or the VAPID public key isn't configured. Requires a
 * user gesture to request permission, so it only subscribes on click.
 */
export function TechNotificationToggle() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window) ||
      !vapidKey
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    // Granted + already subscribed → "on"; granted but no sub, or default → offer.
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (Notification.permission === "granted" && sub) setState("granted");
        else setState("default");
      })
      .catch(() => setState("default"));
  }, [vapidKey]);

  async function enable() {
    if (!vapidKey) return;
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // Cast: TS now types Uint8Array generic over its buffer; the Push API
          // accepts any BufferSource, and ours is plain ArrayBuffer-backed.
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        }));
      const json = sub.toJSON();
      const res = await fetch("/api/v1/tech/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState(res.ok ? "granted" : "default");
    } catch {
      setState("default");
    }
  }

  async function disable() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/v1/tech/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("default");
    } catch {
      setState("granted");
    }
  }

  if (state === "unsupported" || state === "loading") return null;

  if (state === "denied") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-text-muted px-2 py-1"
        title="Notifications are blocked in your browser settings"
      >
        <BellOff size={15} strokeWidth={1.8} /> Off
      </span>
    );
  }

  if (state === "granted") {
    return (
      <button
        onClick={disable}
        className="inline-flex items-center gap-1.5 text-xs text-success hover:text-foreground px-2 py-1 rounded-lg hover:bg-surface"
        title="Notifications on — tap to turn off"
      >
        <BellRing size={15} strokeWidth={1.8} /> Alerts on
      </button>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={state === "working"}
      className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground px-2 py-1 rounded-lg hover:bg-surface disabled:opacity-60"
      title="Get notified when a job is assigned to you"
    >
      {state === "working" ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} strokeWidth={1.8} />}
      Enable alerts
    </button>
  );
}
