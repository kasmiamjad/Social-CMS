export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadForm, type Lead } from "@/components/leads/lead-form";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ leadId: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { leadId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", user.id)
    .maybeSingle<Lead>();

  if (!lead) notFound();

  return (
    <div>
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.8} />
        Back to leads
      </Link>
      <LeadForm mode="edit" initialLead={lead} />
    </div>
  );
}
