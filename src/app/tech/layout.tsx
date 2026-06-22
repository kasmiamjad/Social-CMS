import type { Metadata, Viewport } from "next";
import { TechSwRegister } from "@/components/tech/sw-register";

/**
 * Wraps every /tech route (login, app, offline). Declares the PWA manifest +
 * Apple standalone metadata and registers the service worker. The root layout
 * still owns <html>/<body>; this only adds head metadata and the SW registrar.
 */
export const metadata: Metadata = {
  title: "SA'DA H2O Technician",
  description: "Your installation jobs, daily schedule and site photos.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SA'DA Tech",
  },
};

export const viewport: Viewport = {
  themeColor: "#141B2D",
};

export default function TechRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TechSwRegister />
      {children}
    </>
  );
}
