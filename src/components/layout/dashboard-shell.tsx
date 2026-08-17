"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface DashboardShellProps {
  userEmail?: string;
  children: React.ReactNode;
}

/**
 * Owns the mobile sidebar open/close state shared between the Sidebar
 * (off-canvas drawer below lg) and the Topbar's hamburger button.
 */
export function DashboardShell({ userEmail, children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 min-w-0 lg:ml-[240px]">
        <Topbar userEmail={userEmail} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
