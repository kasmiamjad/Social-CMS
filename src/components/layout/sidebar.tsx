"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BRANDING } from "@/lib/branding";
import {
  LayoutDashboard,
  PlusCircle,
  Clock,
  Settings,
  Images,
  PlayCircle,
  Users,
  UserCheck,
  CalendarCheck,
  CalendarDays,
  Wrench,
  X,
} from "lucide-react";
import { WhatsAppIcon, MessengerIcon, InstagramIcon } from "@/components/icons/platform-icons";

// `hidden: true` keeps the route/code intact but hides the menu entry.
// Flip back to `hidden: false` (or remove the flag) when you want it visible again.
const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, hidden: false },
  { label: "Leads", href: "/leads", icon: Users, hidden: false },
  { label: "Follow-ups", href: "/leads/followups", icon: CalendarDays, hidden: false },
  { label: "WhatsApp", href: "/whatsapp", icon: WhatsAppIcon, hidden: false },
  { label: "Messenger", href: "/messenger", icon: MessengerIcon, hidden: false },
  { label: "Instagram", href: "/instagram", icon: InstagramIcon, hidden: false },
  { label: "Settings", href: "/settings", icon: Settings, hidden: false },
  // ── Hidden for now (code + routes still work, just not in the sidebar) ──
  { label: "Bookings", href: "/bookings", icon: CalendarCheck, hidden: true },
  { label: "Customers", href: "/customers", icon: UserCheck, hidden: true },
  { label: "Technicians", href: "/technicians", icon: Wrench, hidden: true },
  { label: "Create Post", href: "/create", icon: PlusCircle, hidden: true },
  { label: "YouTube", href: "/youtube/videos", icon: PlayCircle, hidden: true },
  { label: "Gallery", href: "/gallery", icon: Images, hidden: true },
  { label: "History", href: "/history", icon: Clock, hidden: true },
];

interface SidebarProps {
  /** Whether the mobile off-canvas drawer is open. Ignored at lg+, where the sidebar is always visible. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "w-[240px] h-screen fixed left-0 top-0 border-r border-border bg-surface-elevated flex flex-col z-50 transition-transform duration-200",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand block — black background, logo forced to pure white via CSS filter */}
        <div className="h-20 bg-black flex items-center justify-between px-4 border-b border-border shrink-0">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center justify-center flex-1 h-full"
          >
            <Image
              src={BRANDING.logo.url}
              alt={BRANDING.logo.alt}
              width={140}
              height={48}
              priority
              className="max-h-12 w-auto [filter:brightness(0)_invert(1)]"
            />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 text-white/70 hover:text-white transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X size={20} strokeWidth={1.8} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.filter((item) => !item.hidden).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface hover:text-foreground"
                )}
              >
                <item.icon size={18} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border shrink-0">
          <div className="px-3 py-2">
            <p className="text-xs text-text-muted">
              {BRANDING.name} v1.0
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
