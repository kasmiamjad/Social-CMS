import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

/**
 * Shown by the service worker when a /tech page navigation fails with no
 * network. Intentionally outside the (app) group so it needs no auth/data.
 */
export default function TechOfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff size={32} strokeWidth={1.6} className="text-text-muted" />
      <h1 className="text-lg font-bold text-foreground">You&apos;re offline</h1>
      <p className="text-sm text-text-muted max-w-xs">
        Reconnect to load your jobs. If you were uploading photos, you&apos;ll need to retry once
        you&apos;re back online.
      </p>
    </div>
  );
}
