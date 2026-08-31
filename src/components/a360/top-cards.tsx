import { Card } from "@/components/ui/card";
import { MapPin, Award } from "lucide-react";
import { A360_ACCENT, A360_ACCENT_ON } from "@/types/a360";

interface TopCardsProps {
  topLocation: { city: string; count: number } | null;
  topAgent: { agentName: string; conversionRatePct: number } | null;
}

export function TopCards({ topLocation, topAgent }: TopCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: A360_ACCENT }}
          >
            <MapPin size={16} strokeWidth={1.8} style={{ color: A360_ACCENT_ON }} />
          </div>
          <div>
            <p className="text-xs text-text-muted">
              Top Location: <span className="text-foreground font-medium">{topLocation?.city ?? "—"}</span>
            </p>
            {topLocation ? (
              <p className="text-sm font-semibold text-foreground">
                {topLocation.count} <span style={{ color: A360_ACCENT }}>Leads</span>
              </p>
            ) : (
              <p className="text-sm text-text-muted">No location data yet</p>
            )}
          </div>
        </div>
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
