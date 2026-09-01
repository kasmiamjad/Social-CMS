import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { WhatsAppIcon, MessengerIcon, InstagramIcon } from "@/components/icons/platform-icons";
import { WHATSAPP, MESSENGER, INSTAGRAM } from "@/components/dashboard/channels-card";

type IconComponent = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

const actions: { label: string; href: string; icon: IconComponent; color: string }[] = [
  { label: "Add lead manually", href: "/leads/new", icon: Plus, color: "var(--color-primary)" },
  { label: "WhatsApp inbox", href: "/whatsapp", icon: WhatsAppIcon, color: WHATSAPP },
  { label: "Messenger inbox", href: "/messenger", icon: MessengerIcon, color: MESSENGER },
  { label: "Instagram inbox", href: "/instagram", icon: InstagramIcon, color: INSTAGRAM },
];

/** Shortcut links to the leads-creation flow and each channel inbox. */
export function QuickActionsCard() {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-5 animate-fade-up" style={{ animationDelay: "200ms" }}>
      <h2 className="text-base font-bold text-foreground font-[family-name:var(--font-heading)] mb-3">Quick actions</h2>
      <div className="space-y-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border hover:bg-surface group transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `color-mix(in srgb, ${a.color} 16%, transparent)`, color: a.color }}
              >
                <a.icon size={15} strokeWidth={1.8} />
              </div>
              <span className="text-sm font-medium text-foreground">{a.label}</span>
            </div>
            <ArrowRight size={14} strokeWidth={1.8} className="text-text-muted group-hover:text-foreground transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
