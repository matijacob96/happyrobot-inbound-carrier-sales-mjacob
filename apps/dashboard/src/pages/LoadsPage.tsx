import { useMemo, useState } from "react";
import { useData } from "../lib/data";
import { useSearch, matchesQuery } from "../lib/search";
import { formatCurrency, formatDateTime } from "../lib/utils";
import { Badge, type BadgeTone } from "../components/ui/badge";

type StatusFilter = "all" | "available" | "booked";

const STATUS_TONE: Record<string, BadgeTone> = {
  available: "success",
  booked: "info",
};

export function LoadsPage() {
  const { loads, error } = useData();
  const { query } = useSearch();
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    return loads
      .filter((l) => {
        if (status !== "all" && (l.status ?? "available") !== status) return false;
        const lane = `${l.origin} → ${l.destination}`;
        if (!matchesQuery(query, l.load_id, l.origin, l.destination, lane, l.equipment_type)) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (a.pickup_datetime ?? "").localeCompare(b.pickup_datetime ?? ""),
      );
  }, [loads, status, query]);

  const totalAvailable = loads.filter((l) => (l.status ?? "available") === "available").length;
  const totalBooked = loads.filter((l) => l.status === "booked").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            Load board
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {totalAvailable} available · {totalBooked} booked
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-white/10 p-1 bg-white/60 dark:bg-slate-900/40">
          {(["all", "available", "booked"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={
                "px-3 py-1 rounded-md text-xs font-medium capitalize transition " +
                (status === s
                  ? "bg-brand-500 text-white shadow"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5")
              }
            >
              {s}
            </button>
          ))}
        </div>
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
              <th>Load #</th>
              <th>Lane</th>
              <th>Pickup</th>
              <th>Equipment</th>
              <th className="text-right">Listed rate</th>
              <th>Status</th>
              <th>Booked by</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500 py-10">
                  {loads.length === 0
                    ? "No loads loaded yet."
                    : "No loads match the current filters."}
                </td>
              </tr>
            )}
            {filtered.map((l) => {
              const st = l.status ?? "available";
              return (
                <tr key={l.load_id}>
                  <td className="font-mono text-xs">{l.load_id}</td>
                  <td>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {l.origin} → {l.destination}
                    </div>
                    {l.miles && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {l.miles} mi
                      </div>
                    )}
                  </td>
                  <td className="text-slate-500 dark:text-slate-300">
                    {formatDateTime(l.pickup_datetime)}
                  </td>
                  <td>{l.equipment_type}</td>
                  <td className="text-right font-mono">
                    {formatCurrency(l.loadboard_rate)}
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[st] ?? "default"}>{st}</Badge>
                  </td>
                  <td className="font-mono text-xs">
                    {l.booked_by_mc ? `MC ${l.booked_by_mc}` : "—"}
                    {l.agreed_rate != null && (
                      <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(l.agreed_rate)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
