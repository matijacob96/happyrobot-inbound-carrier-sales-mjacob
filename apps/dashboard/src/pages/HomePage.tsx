import { useData } from "../lib/data";
import { KpiCards } from "../components/KpiCards";
import {
  CallsPerDayLine,
  OutcomePie,
  SentimentBar,
  TopLoads,
} from "../components/Charts";

export function HomePage() {
  const { metrics, error, loading } = useData();

  if (error) {
    return (
      <div className="card border-rose-300/60 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200 p-4 text-sm">
        <strong className="block">Failed to load data.</strong>
        <span>{error}</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="card p-10 text-center text-slate-500 dark:text-slate-400">
        {loading ? "Loading metrics…" : "No data yet."}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          Operations overview
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Live KPIs and trends across inbound carrier calls.
        </p>
      </div>

      <KpiCards data={metrics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OutcomePie data={metrics} />
        <SentimentBar data={metrics} />
        <CallsPerDayLine data={metrics} />
        <TopLoads data={metrics} />
      </div>
    </div>
  );
}
