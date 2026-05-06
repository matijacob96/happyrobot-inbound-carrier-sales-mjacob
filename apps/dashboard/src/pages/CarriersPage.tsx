import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useSearch, matchesQuery } from "../lib/search";
import { formatCurrency, formatDateTime } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { ArrowRight } from "lucide-react";

interface CarrierAgg {
  mc_number: string;
  carrier_name: string;
  total_calls: number;
  booked: number;
  declined: number;
  not_eligible: number;
  no_load_found: number;
  drop_off: number;
  positive: number;
  neutral: number;
  negative: number;
  total_revenue: number;
  last_call_at?: string;
}

export function CarriersPage() {
  const { calls, error } = useData();
  const { query } = useSearch();

  const carriers = useMemo(() => {
    const map = new Map<string, CarrierAgg>();
    for (const c of calls) {
      const mc = c.mc_number;
      if (!mc) continue;
      const cur = map.get(mc) ?? {
        mc_number: mc,
        carrier_name: c.carrier_name ?? "",
        total_calls: 0,
        booked: 0,
        declined: 0,
        not_eligible: 0,
        no_load_found: 0,
        drop_off: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        total_revenue: 0,
        last_call_at: c.persisted_at ?? c.started_at,
      };
      cur.total_calls += 1;
      // outcome counter
      if (c.outcome === "booked") cur.booked += 1;
      else if (c.outcome === "declined") cur.declined += 1;
      else if (c.outcome === "not_eligible") cur.not_eligible += 1;
      else if (c.outcome === "no_load_found") cur.no_load_found += 1;
      else if (c.outcome === "drop_off") cur.drop_off += 1;
      // sentiment counter
      if (c.sentiment === "positive") cur.positive += 1;
      else if (c.sentiment === "negative") cur.negative += 1;
      else cur.neutral += 1;
      // revenue: only count booked
      if (c.outcome === "booked" && typeof c.final_rate === "number") {
        cur.total_revenue += c.final_rate;
      }
      // carrier name (prefer non-empty)
      if (!cur.carrier_name && c.carrier_name) cur.carrier_name = c.carrier_name;
      // last call
      const ts = c.persisted_at ?? c.started_at;
      if (ts && (!cur.last_call_at || ts > cur.last_call_at)) cur.last_call_at = ts;
      map.set(mc, cur);
    }
    return [...map.values()].sort(
      (a, b) => (b.last_call_at ?? "").localeCompare(a.last_call_at ?? ""),
    );
  }, [calls]);

  const filtered = useMemo(
    () =>
      carriers.filter((c) => matchesQuery(query, c.mc_number, c.carrier_name)),
    [carriers, query],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          Known carriers
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Carriers that have called in, aggregated by MC number.
        </p>
      </div>

      {error && (
        <div className="card border-rose-300/60 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200 p-4 text-sm">
          <strong className="block">Failed to load data.</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>MC #</th>
              <th>Carrier</th>
              <th>Calls</th>
              <th>Booked</th>
              <th>Sentiment</th>
              <th className="text-right">Revenue</th>
              <th>Last call</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-slate-500 py-10">
                  {carriers.length === 0
                    ? "No carriers seen yet."
                    : "No carriers match the current search."}
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.mc_number}>
                <td className="font-mono text-xs">{c.mc_number}</td>
                <td>{c.carrier_name || "—"}</td>
                <td>{c.total_calls}</td>
                <td>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {c.booked}
                  </span>
                  <span className="text-slate-400"> / {c.total_calls}</span>
                </td>
                <td>
                  <div className="flex gap-1">
                    {c.positive > 0 && <Badge tone="success">{c.positive}+</Badge>}
                    {c.neutral > 0 && <Badge tone="default">{c.neutral}=</Badge>}
                    {c.negative > 0 && <Badge tone="danger">{c.negative}-</Badge>}
                  </div>
                </td>
                <td className="text-right font-mono">
                  {formatCurrency(c.total_revenue || undefined)}
                </td>
                <td className="text-slate-500 dark:text-slate-300">
                  {formatDateTime(c.last_call_at)}
                </td>
                <td>
                  <Link
                    to={`/calls?mc=${encodeURIComponent(c.mc_number)}`}
                    className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200 text-sm font-medium"
                  >
                    View calls
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
