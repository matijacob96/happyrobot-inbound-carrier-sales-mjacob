import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CALL_OUTCOMES, CALL_SENTIMENTS } from "@hr/shared";

const NegotiationRoundSchema = z.object({
  round: z.number().int().positive(),
  carrier_offer: z.number(),
  action: z.enum(["accept", "counter", "reject"]),
  counter_offer: z.number().optional(),
});

const CallUpsertBody = z
  .object({
    call_id: z.string().min(1),
    started_at: z.string().optional(),
    ended_at: z.string().optional(),
    duration_seconds: z.coerce.number().nonnegative().optional(),
    mc_number: z.string().optional(),
    carrier_name: z.string().optional(),
    load_id: z.string().optional(),
    outcome: z.enum(CALL_OUTCOMES),
    sentiment: z.enum(CALL_SENTIMENTS).default("neutral"),
    final_rate: z.coerce.number().optional(),
    rounds: z.array(NegotiationRoundSchema).default([]),
    rounds_count: z.coerce.number().int().nonnegative().optional(),
    agreed: z.coerce.boolean().default(false),
    transcript_summary: z.string().optional(),
  })
  .passthrough();

const CallResponseSchema = z
  .object({
    call_id: z.string(),
    saved: z.boolean(),
    persisted_at: z.string(),
  })
  .passthrough();

const ListQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  cursor: z.string().optional(),
  outcome: z.enum(CALL_OUTCOMES).optional(),
  sentiment: z.enum(CALL_SENTIMENTS).optional(),
});

const ListResponse = z.object({
  calls: z.array(z.record(z.unknown())),
  next_cursor: z.string().optional(),
});

export async function callsRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/v1/calls",
    {
      preHandler: app.requireApiKey,
      schema: {
        body: CallUpsertBody,
        response: { 200: CallResponseSchema },
      },
    },
    async (req) => {
      const body = req.body;
      const persistedAt = new Date().toISOString();

      // HappyRobot's voice agent exposes `now.iso` (end of call) and `duration`
      // (seconds) but no explicit start timestamp. If the caller sends ended_at +
      // duration_seconds without a started_at, derive it server-side so the
      // dashboard always has a coherent pair.
      let startedAt = body.started_at;
      if (!startedAt && body.ended_at && body.duration_seconds != null) {
        const endMs = Date.parse(body.ended_at);
        if (Number.isFinite(endMs)) {
          startedAt = new Date(endMs - body.duration_seconds * 1000).toISOString();
        }
      }

      // Prefer rounds_count from HappyRobot's AI Extract (a number);
      // fall back to length of the structured rounds array if present.
      const roundsCount =
        typeof body.rounds_count === "number"
          ? body.rounds_count
          : Array.isArray(body.rounds)
            ? body.rounds.length
            : 0;

      const canonical = {
        call_id: body.call_id,
        started_at: startedAt,
        ended_at: body.ended_at,
        duration_seconds: body.duration_seconds,
        mc_number: body.mc_number,
        carrier_name: body.carrier_name,
        load_id: body.load_id,
        outcome: body.outcome,
        sentiment: body.sentiment,
        final_rate: body.final_rate,
        rounds: body.rounds,
        rounds_count: roundsCount,
        agreed: body.agreed,
        transcript_summary: body.transcript_summary,
        persisted_at: persistedAt,
      };

      const known = new Set(Object.keys(canonical));
      const raw_payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) {
        if (!known.has(k)) raw_payload[k] = v;
      }

      const doc = {
        ...canonical,
        ...(Object.keys(raw_payload).length > 0 ? { raw_payload } : {}),
      };

      await app.db.collection("calls").doc(body.call_id).set(doc, { merge: true });

      req.log.info(
        {
          call_id: body.call_id,
          outcome: body.outcome,
          sentiment: body.sentiment,
          agreed: body.agreed,
        },
        "call persisted",
      );

      return {
        call_id: body.call_id,
        saved: true,
        persisted_at: persistedAt,
      };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/v1/calls",
    {
      preHandler: app.requireApiKey,
      schema: {
        querystring: ListQuery,
        response: { 200: ListResponse },
      },
    },
    async (req) => {
      const { limit, cursor, outcome, sentiment } = req.query;
      let q = app.db.collection("calls").orderBy("persisted_at", "desc") as
        | FirebaseFirestore.Query
        | FirebaseFirestore.CollectionReference;

      if (outcome) {
        q = (q as FirebaseFirestore.Query).where("outcome", "==", outcome);
      }
      if (sentiment) {
        q = (q as FirebaseFirestore.Query).where("sentiment", "==", sentiment);
      }
      if (cursor) {
        q = (q as FirebaseFirestore.Query).startAfter(cursor);
      }

      const snap = await (q as FirebaseFirestore.Query).limit(limit).get();
      const calls = snap.docs.map((d) => d.data());
      const last = snap.docs[snap.docs.length - 1];
      const next_cursor =
        snap.size === limit && last
          ? (last.data().persisted_at as string | undefined)
          : undefined;

      return next_cursor ? { calls, next_cursor } : { calls };
    },
  );
}
