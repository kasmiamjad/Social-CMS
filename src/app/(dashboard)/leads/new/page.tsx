import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeadForm } from "@/components/leads/lead-form";

export default function NewLeadPage() {
  return (
    <div>
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.8} />
        Back to leads
      </Link>
      <LeadForm mode="create" initialLead={null} />
    </div>
  );
}
