"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { A360_STATUS_DOT_CLASS, A360_STATUS_HEX, A360_STATUS_LABELS } from "@/types/a360";
import type { A360Status, A360StatusShare } from "@/types/a360";

interface StatusDonutProps {
  shares: A360StatusShare[];
  totalLeads: number;
}

export function StatusDonut({ shares, totalLeads }: StatusDonutProps) {
  const [selected, setSelected] = useState<A360Status | null>(null);
  const chartData = shares
    .filter((s) => s.count > 0)
    .map((s) => ({ name: A360_STATUS_LABELS[s.status], value: s.count, status: s.status }));

  function hoverOn(status: A360Status) {
    setSelected(status);
  }

  function hoverOff() {
    setSelected(null);
  }

  const selectedShare = selected ? shares.find((s) => s.status === selected) : null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Leads Overview &amp; Status Share
        </h3>
        <span className="text-xs text-text-muted">{totalLeads} Leads Total</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
        <div className="relative h-56 [&_*:focus]:outline-none [&_*]:focus-visible:outline-none">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius="65%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="none"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={A360_STATUS_HEX[entry.status]}
                    stroke={selected === entry.status ? "#fff" : "transparent"}
                    strokeWidth={selected === entry.status ? 3 : 0}
                    onMouseEnter={() => hoverOn(entry.status)}
                    onMouseLeave={hoverOff}
                    tabIndex={-1}
                    style={{
                      cursor: "pointer",
                      outline: "none",
                      filter: selected && selected !== entry.status ? "opacity(0.45)" : "none",
                    }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
            {selectedShare ? (
              <>
                <p
                  className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)]"
                  style={{ color: A360_STATUS_HEX[selectedShare.status] }}
                >
                  {selectedShare.count}
                </p>
                <p
                  className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: A360_STATUS_HEX[selectedShare.status] }}
                >
                  {A360_STATUS_LABELS[selectedShare.status]} ({selectedShare.sharePct.toFixed(1)}%)
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
                  {totalLeads}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-text-muted">Total Leads</p>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {shares.map((s) => (
            <div
              key={s.status}
              onMouseEnter={() => s.count > 0 && hoverOn(s.status)}
              onMouseLeave={hoverOff}
              className={`text-left rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${
                selected === s.status ? "bg-surface" : "hover:bg-surface/60"
              } ${s.count === 0 ? "opacity-40" : ""}`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${A360_STATUS_DOT_CLASS[s.status]}`} />
                <span className="text-xs text-text-muted">
                  {A360_STATUS_LABELS[s.status]} ({s.count})
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground mt-0.5">{s.sharePct.toFixed(1)}% Share</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
