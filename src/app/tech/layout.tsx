import type { Metadata, Viewport } from "next";
import { TechSwRegister } from "@/components/tech/sw-register";

/**
 * Wraps every /tech route (login, app, offline). Declares the PWA manifest +
 * Apple standalone metadata and registers the service worker. The root layout
 * still owns <html>/<body>; this only adds head metadata and the SW registrar.
 */
export const metadata: Metadata = {
  title: "a3sixty Technician",
  description: "Your installation jobs, daily schedule and site photos.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "a3 Tech",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A56DB",
};

export default function TechRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TechSwRegister />
      {children}
    </>
  );
}
