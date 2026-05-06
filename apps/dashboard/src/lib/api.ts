import type { MetricsSummary } from "@hr/shared";

const BASE_URL_KEY = "hr.api.base";

/**
 * Resolve the base URL the dashboard should hit.
 *
 * Priority:
 *   1. localStorage override (only set via the hidden ?settings=1 panel — debug)
 *   2. VITE_API_BASE_URL injected at build time (kept as an escape hatch)
 *   3. "/api" — same-origin path served by the nginx BFF in the dashboard
 *      container, which proxies to the real API and injects x-api-key
 *      server-side. The browser never holds an API key.
 *
 * In Vite dev (`pnpm dev`) the dev server proxies /api the same way; see
 * vite.config.ts.
 */
export function getApiBase(): string {
  return (
    localStorage.getItem(BASE_URL_KEY) ??
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    "/api"
  );
}

export function setApiBase(value: string): void {
  if (value) localStorage.setItem(BASE_URL_KEY, value);
  else localStorage.removeItem(BASE_URL_KEY);
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBase();
  const url = `${base.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `${res.status} ${res.statusText} — ${text.slice(0, 240) || "(no body)"}`,
    );
  }
  return (await res.json()) as T;
}

export interface NegotiationRoundRow {
  round: number;
  carrier_offer?: number;
  action?: string;
  counter_offer?: number;
  loadboard_rate?: number;
  reason?: string;
}

export interface CallRow extends Record<string, unknown> {
  call_id: string;
  outcome: string;
  sentiment: string;
  agreed?: boolean;
  load_id?: string;
  mc_number?: string;
  carrier_name?: string;
  final_rate?: number;
  rounds?: NegotiationRoundRow[];
  rounds_count?: number;
  persisted_at?: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  transcript_summary?: string;
}

export interface CallsList {
  calls: CallRow[];
  next_cursor?: string;
}

export interface LoadRow {
  load_id: string;
  origin: string;
  destination: string;
  pickup_datetime: string;
  delivery_datetime?: string;
  equipment_type: string;
  loadboard_rate: number;
  notes?: string;
  weight?: number;
  commodity_type?: string;
  num_of_pieces?: number;
  miles?: number;
  dimensions?: string;
  status?: string;
  booked_by_mc?: string;
  agreed_rate?: number;
  booked_at?: string;
}

export interface LoadsList {
  loads: LoadRow[];
  total: number;
}

export const api = {
  metrics: () => apiFetch<MetricsSummary>("/v1/metrics/summary"),
  calls: (
    opts: { limit?: number; outcome?: string; sentiment?: string; cursor?: string } = {},
  ) => {
    const q = new URLSearchParams();
    if (opts.limit) q.set("limit", String(opts.limit));
    if (opts.outcome) q.set("outcome", opts.outcome);
    if (opts.sentiment) q.set("sentiment", opts.sentiment);
    if (opts.cursor) q.set("cursor", opts.cursor);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return apiFetch<CallsList>(`/v1/calls${suffix}`);
  },
  loads: (opts: { status?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.status) q.set("status", opts.status);
    if (opts.limit) q.set("limit", String(opts.limit));
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return apiFetch<LoadsList>(`/v1/loads${suffix}`);
  },
  health: () => apiFetch<{ status: string }>("/health"),
};
