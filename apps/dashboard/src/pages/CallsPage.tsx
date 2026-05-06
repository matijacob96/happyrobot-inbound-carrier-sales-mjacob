import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CallsTable } from "../components/CallsTable";
import { CallDetailDrawer } from "../components/CallDetailDrawer";
import { useData } from "../lib/data";
import { useSearch, matchesQuery } from "../lib/search";
import type { CallRow } from "../lib/api";
import { Button } from "../components/ui/button";
import { X } from "lucide-react";

const OUTCOMES = ["booked", "declined", "not_eligible", "no_load_found", "drop_off"] as const;
const SENTIMENTS = ["positive", "neutral", "negative"] as const;

export function CallsPage() {
  const { calls, error, loading } = useData();
  const { query } = useSearch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<CallRow | null>(null);

  const outcome = searchParams.get("outcome") ?? "";
  const sentiment = searchParams.get("sentiment") ?? "";
  const mcFilter = searchParams.get("mc") ?? "";

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (outcome && c.outcome !== outcome) return false;
      if (sentiment && c.sentiment !== sentiment) return false;
      if (mcFilter && c.mc_number !== mcFilter) return false;
      if (
        !matchesQuery(
          query,
          c.call_id,
          c.mc_number,
          c.carrier_name,
          c.load_id,
          c.outcome,
          c.sentiment,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [calls, outcome, sentiment, mcFilter, query]);

  // Keep selected drawer in sync if calls list refreshes (live polling).
  useEffect(() => {
    if (!selected) return;
    const fresh = calls.find((c) => c.call_id === selected.call_id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [calls, selected]);

  const hasFilters = outcome || sentiment || mcFilter;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            Recent calls
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Click any row for the full transcript, negotiation rounds and raw payload.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Outcome"
            value={outcome}
            options={OUTCOMES}
            onChange={(v) => updateParam("outcome", v)}
          />
          <FilterSelect
            label="Sentiment"
            value={sentiment}
            options={SENTIMENTS}
            onChange={(v) => updateParam("sentiment", v)}
          />
          {mcFilter && (
            <span className="inline-flex items-center gap-1 rounded-md border border-brand-300 bg-brand-50 px-2 py-1 text-xs text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
              MC #{mcFilter}
              <button
                aria-label="Clear MC filter"
                onClick={() => updateParam("mc", "")}
                className="hover:opacity-80"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="card border-rose-300/60 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200 p-4 text-sm">
          <strong className="block">Failed to load calls.</strong>
          <span>{error}</span>
        </div>
      )}

      <CallsTable rows={filtered} onSelect={(c) => setSelected(c)} loading={loading} />

      <CallDetailDrawer
        call={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
