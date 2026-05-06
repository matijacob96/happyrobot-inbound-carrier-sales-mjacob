import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { MetricsSummary } from "@hr/shared";
import { api, type CallRow, type LoadRow } from "./api";

interface DataContextValue {
  loading: boolean;
  error: string | null;
  metrics: MetricsSummary | null;
  calls: CallRow[];
  loads: LoadRow[];
  refresh: () => Promise<void>;
  bumpRefresh: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const POLL_INTERVAL_MS = 10_000;

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loads, setLoads] = useState<LoadRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const [m, c, l] = await Promise.all([
        api.metrics(),
        api.calls({ limit: 100 }),
        api.loads({ limit: 200 }),
      ]);
      setMetrics(m);
      setCalls(c.calls);
      setLoads(l.loads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <DataContext.Provider
      value={{ loading, error, metrics, calls, loads, refresh, bumpRefresh }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
