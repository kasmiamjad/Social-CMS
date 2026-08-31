import { Card } from "@/components/ui/card";
import { MapPin, Award } from "lucide-react";
import { A360_ACCENT, A360_ACCENT_ON } from "@/types/a360";

interface TopCardsProps {
  locationBreakdown: { city: string; count: number }[];
  topAgent: { agentName: string; conversionRatePct: number } | null;
}

export function TopCards({ locationBreakdown, topAgent }: TopCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: A360_ACCENT }}
          >
            <MapPin size={16} strokeWidth={1.8} style={{ color: A360_ACCENT_ON }} />
          </div>
          <p className="text-sm font-semibold text-foreground">Leads by Location</p>
        </div>
        {locationBreakdown.length === 0 ? (
          <p className="text-sm text-text-muted">No location data yet</p>
        ) : (
          <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {locationBreakdown.map((loc) => (
              <li key={loc.city} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-text-muted truncate">{loc.city}</span>
                <span className="font-semibold shrink-0" style={{ color: A360_ACCENT }}>
                  {loc.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: A360_ACCENT }}
          >
            <Award size={16} strokeWidth={1.8} style={{ color: A360_ACCENT_ON }} />
          </div>
          <div>
            <p className="text-xs text-text-muted">
              Top Agent: <span className="text-foreground font-medium">{topAgent?.agentName ?? "—"}</span>
            </p>
            {topAgent ? (
              <p className="text-sm font-semibold text-foreground">
                {topAgent.conversionRatePct.toFixed(1)}% <span style={{ color: A360_ACCENT }}>Conv.</span>
              </p>
            ) : (
              <p className="text-sm text-text-muted">No agent data yet</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
