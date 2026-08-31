import { Card } from "@/components/ui/card";
import { MapPin, Award } from "lucide-react";

interface TopCardsProps {
  topLocation: { city: string; count: number } | null;
  topAgent: { agentName: string; conversionRatePct: number } | null;
}

export function TopCards({ topLocation, topAgent }: TopCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin size={16} strokeWidth={1.8} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-text-muted">Top Location</p>
            {topLocation ? (
              <p className="text-sm font-semibold text-foreground">
                {topLocation.city} · <span className="text-primary">{topLocation.count} Leads</span>
              </p>
            ) : (
              <p className="text-sm text-text-muted">No location data yet</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <Award size={16} strokeWidth={1.8} className="text-success" />
          </div>
          <div>
            <p className="text-xs text-text-muted">Top Agent</p>
            {topAgent ? (
              <p className="text-sm font-semibold text-foreground">
                {topAgent.agentName} · <span className="text-success">{topAgent.conversionRatePct.toFixed(1)}% Conv.</span>
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
