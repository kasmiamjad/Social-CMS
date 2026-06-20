export const dynamic = "force-dynamic";

import { CalendarRange } from "lucide-react";

export default function TechSchedulePage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-5">Schedule</h1>
      <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center">
        <CalendarRange size={28} strokeWidth={1.5} className="text-text-muted mx-auto mb-3" />
        <p className="text-sm text-text-muted">A calendar view of your upcoming jobs is coming soon.</p>
      </div>
    </div>
  );
}
