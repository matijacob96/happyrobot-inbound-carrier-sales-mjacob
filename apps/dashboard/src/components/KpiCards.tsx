import type { MetricsSummary } from "@hr/shared";
import { formatCurrency, formatPercent } from "../lib/utils";
import { PhoneCall, CheckCircle2, DollarSign, Repeat } from "lucide-react";

export function KpiCards({ data }: { data: MetricsSummary }) {
  const items = [
    {
      label: "Total calls",
      value: data.total_calls.toLocaleString(),
      icon: PhoneCall,
      sub: `${data.by_outcome.booked ?? 0} booked`,
    },
    {
      label: "Conversion rate",
      value: formatPercent(data.conversion_rate * 100, 1),
      icon: CheckCircle2,
      sub: "Booked / total",
    },
    {
      label: "Avg final rate",
      value: formatCurrency(data.avg_final_rate),
      icon: DollarSign,
      sub:
        data.avg_negotiation_delta_pct > 0
          ? `+${data.avg_negotiation_delta_pct.toFixed(1)}% vs listed`
          : `${data.avg_negotiation_delta_pct.toFixed(1)}% vs listed`,
    },
    {
      label: "Avg rounds / call",
      value: data.avg_rounds_per_call.toFixed(2),
      icon: Repeat,
      sub: "Negotiation depth",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="kpi-label">{it.label}</span>
              <Icon className="h-4 w-4 text-brand-300" />
            </div>
            <div className="kpi-value mt-3">{it.value}</div>
            <div className="text-xs text-slate-400 mt-1">{it.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
