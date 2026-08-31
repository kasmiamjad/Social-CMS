import Link from "next/link";
import { BRANDING } from "@/lib/branding";
import { MessageCircle, Send, Camera, type LucideIcon } from "lucide-react";

// Channel brand colours. WhatsApp's comes from the branding token; Messenger/
// Instagram have no in-app equivalent yet, so those stay as external literals.
export const WHATSAPP = BRANDING.semantic.whatsapp;
export const MESSENGER = "#0084FF";
export const INSTAGRAM = "#E1306C";

interface ChannelsCardProps {
  whatsapp: number;
  messenger: number;
  instagram: number;
  total: number;
}

/** Per-channel conversation-count breakdown with a share bar, linking to each inbox. */
export function ChannelsCard({ whatsapp, messenger, instagram, total }: ChannelsCardProps) {
  const rows: { label: string; count: number; color: string; icon: LucideIcon; href: string }[] = [
    { label: "WhatsApp", count: whatsapp, color: WHATSAPP, icon: MessageCircle, href: "/whatsapp" },
    { label: "Messenger", count: messenger, color: MESSENGER, icon: Send, href: "/messenger" },
    { label: "Instagram", count: instagram, color: INSTAGRAM, icon: Camera, href: "/instagram" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-5 animate-fade-up" style={{ animationDelay: "160ms" }}>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-base font-bold text-foreground font-[family-name:var(--font-heading)]">Channels</h2>
        <span className="text-xs text-text-muted">{total} conversation{total === 1 ? "" : "s"}</span>
      </div>
      <div className="space-y-3.5">
        {rows.map((r) => {
          const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
          return (
            <Link key={r.label} href={r.href} className="block group">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
                  style={{ backgroundColor: `color-mix(in srgb, ${r.color} 16%, transparent)`, color: r.color }}
                >
                  <r.icon size={14} strokeWidth={1.9} />
                </div>
                <span className="text-sm text-foreground flex-1 group-hover:text-primary transition-colors">{r.label}</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{r.count}</span>
              </div>
              <div className="mt-1.5 ml-[38px] h-1.5 rounded-full bg-surface overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: r.color }} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
