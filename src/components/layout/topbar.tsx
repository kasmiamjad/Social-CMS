"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Menu } from "lucide-react";
import { ActingAsSwitcher } from "./acting-as-switcher";

interface TopbarProps {
  userEmail?: string;
  onMenuClick: () => void;
}

export function Topbar({ userEmail, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 border-b border-border bg-surface-elevated flex items-center justify-between px-3 sm:px-6 gap-2">
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden p-1.5 -ml-1.5 text-text-muted hover:text-foreground transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu size={20} strokeWidth={1.8} />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <ActingAsSwitcher />
        {userEmail && (
          <span className="hidden sm:inline text-sm text-text-muted truncate max-w-[180px]">{userEmail}</span>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
        >
          <LogOut size={16} strokeWidth={1.8} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
