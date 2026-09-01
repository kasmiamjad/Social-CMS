"use client";

import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { A360_STATUS_HEX, A360_STATUS_LABELS, A360_STATUS_VALUES } from "@/types/a360";
import type { A360TrendPoint } from "@/types/a360";

interface DailyTrendChartProps {
  points: A360TrendPoint[];
}

export function DailyTrendChart({ points }: DailyTrendChartProps) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} strokeWidth={1.8} className="text-success" />
        <h3 className="text-base font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Daily Trend
        </h3>
      </div>

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="notInterestedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={A360_STATUS_HEX.not_interested} stopOpacity={0.55} />
                <stop offset="100%" stopColor={A360_STATUS_HEX.not_interested} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Legend
              formatter={(value) => <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{value}</span>}
            />
            {/* Filled area under the usually-dominant "Not Interested" series, drawn first
                so every Line renders on top of it — a gradient (not flat opacity) so it
                actually reads as a deep "shadow" near the line, matching the reference. */}
            <Area
              type="monotone"
              dataKey="not_interested"
              fill="url(#notInterestedFill)"
              stroke="none"
              legendType="none"
              isAnimationActive={false}
            />
            {A360_STATUS_VALUES.map((status) => (
              <Line
                key={status}
                type="monotone"
                dataKey={status}
                name={A360_STATUS_LABELS[status]}
                stroke={A360_STATUS_HEX[status]}
                strokeWidth={2}
                dot={{ r: 3, fill: A360_STATUS_HEX[status], strokeWidth: 0 }}
              />
            ))}
            {/* Drawn last so it renders on top — the aggregate across every status. */}
            <Line
              type="monotone"
              dataKey="total"
              name="Total"
              stroke="var(--foreground)"
              strokeWidth={2.5}
              strokeDasharray="5 3"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
