import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { A360_ACCENT, A360_ACCENT_ON } from "@/types/a360";

interface TopCardsProps {
  locationBreakdown: { city: string; count: number }[];
}

/** Top Agent moved into the top KPI row — see kpi-cards.tsx. */
export function TopCards({ locationBreakdown }: TopCardsProps) {
  return (
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
  );
}
