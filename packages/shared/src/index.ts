export const CALL_OUTCOMES = [
  "booked",
  "declined",
  "not_eligible",
  "no_load_found",
  "drop_off",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type CallSentiment = (typeof CALL_SENTIMENTS)[number];

export const LOAD_STATUSES = ["available", "booked"] as const;
export type LoadStatus = (typeof LOAD_STATUSES)[number];

export interface Load {
  load_id: string;
  origin: string;
  destination: string;
  pickup_datetime: string;
  delivery_datetime: string;
  equipment_type: string;
  loadboard_rate: number;
  notes?: string;
  weight: number;
  commodity_type: string;
  num_of_pieces: number;
  miles: number;
  dimensions?: string;
  status: LoadStatus;
  booked_by_mc?: string;
  booked_at?: string;
  agreed_rate?: number;
}

export interface CarrierVerification {
  mc_number: string;
  eligible: boolean;
  carrier_name?: string;
  dot_number?: string;
  allowed_to_operate?: boolean;
  reasons: string[];
  verified_at: string;
}

export interface NegotiationRound {
  round: number;
  carrier_offer: number;
  action: "accept" | "counter" | "reject";
  counter_offer?: number;
}

export interface CallRecord {
  call_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  mc_number?: string;
  carrier_name?: string;
  load_id?: string;
  outcome: CallOutcome;
  sentiment: CallSentiment;
  final_rate?: number;
  rounds: NegotiationRound[];
  rounds_count?: number;
  agreed: boolean;
  transcript_summary?: string;
  raw_payload?: Record<string, unknown>;
}

export interface MetricsSummary {
  total_calls: number;
  by_outcome: Record<CallOutcome, number>;
  by_sentiment: Record<CallSentiment, number>;
  conversion_rate: number;
  avg_loadboard_rate: number;
  avg_final_rate: number;
  avg_negotiation_delta_pct: number;
  avg_rounds_per_call: number;
  calls_per_day: { date: string; count: number }[];
  top_loads_pitched: { load_id: string; count: number }[];
  top_loads_booked: { load_id: string; count: number }[];
  generated_at: string;
}
