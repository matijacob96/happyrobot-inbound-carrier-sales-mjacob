import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CALL_OUTCOMES, CALL_SENTIMENTS, type CallOutcome, type CallSentiment } from "@hr/shared";

const SummaryResponse = z.object({
  total_calls: z.number(),
  by_outcome: z.record(z.string(), z.number()),
  by_sentiment: z.record(z.string(), z.number()),
  conversion_rate: z.number(),
  avg_loadboard_rate: z.number(),
  avg_final_rate: z.number(),
  avg_negotiation_delta_pct: z.number(),
  avg_rounds_per_call: z.number(),
  calls_per_day: z.array(z.object({ date: z.string(), count: z.number() })),
  top_loads_pitched: z.array(z.object({ load_id: z.string(), count: z.number() })),
  top_loads_booked: z.array(z.object({ load_id: z.string(), count: z.number() })),
  generated_at: z.string(),
});

interface CallDoc {
  outcome: CallOutcome;
  sentiment: CallSentiment;
  final_rate?: number;
  load_id?: string;
  agreed?: boolean;
  rounds?: { round: number }[];
  rounds_count?: number;
  persisted_at?: string;
  started_at?: string;
}

interface LoadDoc {
  load_id: string;
  loadboard_rate: number;
}

function emptyOutcomes(): Record<CallOutcome, number> {
  const o = {} as Record<CallOutcome, number>;
  for (const k of CALL_OUTCOMES) o[k] = 0;
  return o;
}
function emptySentiments(): Record<CallSentiment, number> {
  const o = {} as Record<CallSentiment, number>;
  for (const k of CALL_SENTIMENTS) o[k] = 0;
  return o;
}

function dayKey(iso: string | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

function topN(counts: Map<string, number>, n: number): { load_id: string; count: number }[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([load_id, count]) => ({ load_id, count }));
}

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/v1/metrics/summary",
    {
      preHandler: app.requireApiKey,
      schema: { response: { 200: SummaryResponse } },
    },
    async () => {
      const callsSnap = await app.db.collection("calls").get();
      const calls = callsSnap.docs.map((d) => d.data() as CallDoc);

      const total = calls.length;
      const byOutcome = emptyOutcomes();
      const bySentiment = emptySentiments();
      const callsPerDay = new Map<string, number>();
      const pitched = new Map<string, number>();
      const booked = new Map<string, number>();
      let bookedCount = 0;
      let roundsTotal = 0;
      let finalRateSum = 0;
      let finalRateN = 0;

      for (const c of calls) {
        if (CALL_OUTCOMES.includes(c.outcome)) byOutcome[c.outcome]++;
        if (CALL_SENTIMENTS.includes(c.sentiment)) bySentiment[c.sentiment]++;

        const day = dayKey(c.persisted_at ?? c.started_at);
        if (day) callsPerDay.set(day, (callsPerDay.get(day) ?? 0) + 1);

        if (c.load_id) {
          pitched.set(c.load_id, (pitched.get(c.load_id) ?? 0) + 1);
        }
        if (c.outcome === "booked") {
          bookedCount++;
          if (c.load_id) booked.set(c.load_id, (booked.get(c.load_id) ?? 0) + 1);
        }
        roundsTotal += c.rounds_count ?? c.rounds?.length ?? 0;
        if (typeof c.final_rate === "number") {
          finalRateSum += c.final_rate;
          finalRateN++;
        }
      }

      // Pull loadboard rates only for loads that appear in pitched/booked sets — avoids full-collection scan
      const involvedLoadIds = new Set<string>([...pitched.keys(), ...booked.keys()]);
      let loadRateSum = 0;
      let loadRateN = 0;
      let negotiationDeltaSum = 0;
      let negotiationDeltaN = 0;

      if (involvedLoadIds.size > 0) {
        const refs = [...involvedLoadIds].map((id) => app.db.collection("loads").doc(id));
        const loadSnaps = await app.db.getAll(...refs);
        const rateByLoad = new Map<string, number>();
        for (const s of loadSnaps) {
          if (s.exists) {
            const ld = s.data() as LoadDoc;
            rateByLoad.set(ld.load_id, ld.loadboard_rate);
            loadRateSum += ld.loadboard_rate;
            loadRateN++;
          }
        }
        for (const c of calls) {
          if (c.outcome === "booked" && c.load_id && typeof c.final_rate === "number") {
            const listed = rateByLoad.get(c.load_id);
            if (listed && listed > 0) {
              negotiationDeltaSum += ((c.final_rate - listed) / listed) * 100;
              negotiationDeltaN++;
            }
          }
        }
      }

      const sortedDays = [...callsPerDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));

      return {
        total_calls: total,
        by_outcome: byOutcome,
        by_sentiment: bySentiment,
        conversion_rate: total > 0 ? bookedCount / total : 0,
        avg_loadboard_rate: loadRateN > 0 ? loadRateSum / loadRateN : 0,
        avg_final_rate: finalRateN > 0 ? finalRateSum / finalRateN : 0,
        avg_negotiation_delta_pct:
          negotiationDeltaN > 0 ? negotiationDeltaSum / negotiationDeltaN : 0,
        avg_rounds_per_call: total > 0 ? roundsTotal / total : 0,
        calls_per_day: sortedDays,
        top_loads_pitched: topN(pitched, 5),
        top_loads_booked: topN(booked, 5),
        generated_at: new Date().toISOString(),
      };
    },
  );
}
