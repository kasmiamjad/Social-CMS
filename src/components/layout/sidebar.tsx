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
  MessageCircle,
  Camera,
  Users,
  UserCheck,
  CalendarCheck,
  CalendarDays,
  Send,
  Wrench,
} from "lucide-react";

// `hidden: true` keeps the route/code intact but hides the menu entry.
// Flip back to `hidden: false` (or remove the flag) when you want it visible again.
const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, hidden: false },
  { label: "Leads", href: "/leads", icon: Users, hidden: false },
  { label: "Follow-ups", href: "/leads/followups", icon: CalendarDays, hidden: false },
  { label: "Bookings", href: "/bookings", icon: CalendarCheck, hidden: false },
  { label: "Customers", href: "/customers", icon: UserCheck, hidden: false },
  { label: "Technicians", href: "/technicians", icon: Wrench, hidden: false },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle, hidden: false },
  { label: "Messenger", href: "/messenger", icon: Send, hidden: false },
  { label: "Instagram", href: "/instagram", icon: Camera, hidden: false },
  { label: "Settings", href: "/settings", icon: Settings, hidden: false },
  // ── Hidden for now (code + routes still work, just not in the sidebar) ──
  { label: "Create Post", href: "/create", icon: PlusCircle, hidden: true },
  { label: "YouTube", href: "/youtube/videos", icon: PlayCircle, hidden: true },
  { label: "Gallery", href: "/gallery", icon: Images, hidden: true },
  { label: "History", href: "/history", icon: Clock, hidden: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] h-screen fixed left-0 top-0 border-r border-border bg-surface-elevated flex flex-col">
      {/* Brand block — black background, logo forced to pure white via CSS filter */}
      <div className="h-20 bg-black flex items-center justify-center px-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center justify-center w-full h-full">
          <Image
            src={BRANDING.logo.url}
            alt={BRANDING.logo.alt}
            width={140}
            height={48}
            priority
            className="max-h-12 w-auto [filter:brightness(0)_invert(1)]"
          />
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.filter((item) => !item.hidden).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
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

      <div className="p-3 border-t border-border">
        <div className="px-3 py-2">
          <p className="text-xs text-text-muted">
            {BRANDING.name} v1.0
          </p>
        </div>
      </div>
    </aside>
  );
}
