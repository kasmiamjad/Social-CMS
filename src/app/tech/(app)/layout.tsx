export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getTechSession } from "@/lib/tech-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TechShell } from "@/components/tech/tech-shell";

export default async function TechAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getTechSession();
  if (!session) redirect("/tech/login");

  const admin = createAdminClient();
  const { data: tech } = await admin
    .from("technicians")
    .select("name, is_active")
    .eq("id", session.tid)
    .maybeSingle<{ name: string; is_active: boolean }>();

  // Technician removed or deactivated since the cookie was issued.
  if (!tech || !tech.is_active) redirect("/tech/login");

  return <TechShell techName={tech.name}>{children}</TechShell>;
}
