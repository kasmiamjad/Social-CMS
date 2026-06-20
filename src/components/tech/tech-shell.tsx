"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogOut, CalendarDays, ClipboardList, CalendarRange } from "lucide-react";

const NAV = [
  { label: "Today", href: "/tech", icon: CalendarDays },
  { label: "Bookings", href: "/tech/bookings", icon: ClipboardList },
  { label: "Schedule", href: "/tech/schedule", icon: CalendarRange },
];

/** Mobile-first shell for the technician panel: top bar + bottom tab nav. */
export function TechShell({ techName, children }: { techName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/v1/tech/logout", { method: "POST" });
    router.replace("/tech/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 z-20 bg-surface-elevated border-b border-border h-14 flex items-center justify-between px-4">
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted leading-none">Technician</div>
          <div className="text-sm font-bold text-foreground truncate">{techName}</div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground px-2 py-1 rounded-lg hover:bg-surface"
        >
          <LogOut size={15} strokeWidth={1.8} /> Logout
        </button>
      </header>

      <main className="flex-1 p-4 pb-24 max-w-lg w-full mx-auto">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-surface-elevated border-t border-border">
        <div className="max-w-lg mx-auto grid grid-cols-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-text-muted hover:text-foreground"
                )}
              >
                <item.icon size={20} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
