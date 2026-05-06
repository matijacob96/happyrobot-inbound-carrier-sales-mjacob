import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { LOAD_STATUSES } from "@hr/shared";

const LoadSchema = z.object({
  load_id: z.string(),
  origin: z.string(),
  destination: z.string(),
  pickup_datetime: z.string(),
  delivery_datetime: z.string(),
  equipment_type: z.string(),
  loadboard_rate: z.number(),
  notes: z.string().optional(),
  weight: z.number(),
  commodity_type: z.string(),
  num_of_pieces: z.number(),
  miles: z.number(),
  dimensions: z.string().optional(),
  status: z.enum(LOAD_STATUSES),
  booked_by_mc: z.string().optional(),
  booked_at: z.string().optional(),
  agreed_rate: z.number().optional(),
});

const SearchQuery = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  equipment_type: z.string().optional(),
  pickup_after: z.string().optional(),
  max_weight: z.coerce.number().positive().optional(),
  limit: z.coerce.number().int().positive().max(20).default(5),
});

const SearchResponse = z.object({
  loads: z.array(LoadSchema),
  total: z.number(),
});

const ListQuery = z.object({
  status: z.enum(LOAD_STATUSES).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

const BookBody = z.object({
  agreed_rate: z.number().positive(),
  mc_number: z.string().min(2),
});

const BookResponse = z.object({
  booked: z.boolean(),
  load: LoadSchema,
  transfer_message: z.string(),
});

function tokenize(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function locationMatchScore(
  haystack: string,
  needleTokens: string[],
): number {
  if (needleTokens.length === 0) return 0;
  const lower = haystack.toLowerCase();
  let hits = 0;
  for (const token of needleTokens) {
    if (lower.includes(token)) hits++;
  }
  return hits / needleTokens.length;
}

export async function loadsRoutes(app: FastifyInstance): Promise<void> {
  // List loads (used by the dashboard's Loads page).
  // Filtered by Firestore where possible; ordered by pickup_datetime asc.
  app.withTypeProvider<ZodTypeProvider>().get(
    "/v1/loads",
    {
      preHandler: app.requireApiKey,
      schema: {
        querystring: ListQuery,
        response: { 200: SearchResponse },
      },
    },
    async (req) => {
      const { status, limit } = req.query;
      let q = app.db
        .collection("loads")
        .orderBy("pickup_datetime", "asc") as FirebaseFirestore.Query;
      if (status) {
        q = q.where("status", "==", status);
      }
      const snap = await q.limit(limit).get();
      const loads = snap.docs.map((d) => d.data() as z.infer<typeof LoadSchema>);
      return { loads, total: loads.length };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/v1/loads/search",
    {
      preHandler: app.requireApiKey,
      schema: {
        querystring: SearchQuery,
        response: { 200: SearchResponse },
      },
    },
    async (req) => {
      const { origin, destination, equipment_type, pickup_after, max_weight, limit } =
        req.query;

      // Only filter by status in Firestore. We apply equipment_type, pickup_after
      // and max_weight in memory to avoid requiring composite indexes (the POC
      // dataset is tiny — under a few hundred loads — so this is cheap and keeps
      // infra setup zero-touch).
      const snap = await app.db
        .collection("loads")
        .where("status", "==", "available")
        .limit(200)
        .get();
      let candidates = snap.docs.map((d) => d.data() as z.infer<typeof LoadSchema>);

      if (equipment_type) {
        const eq = equipment_type.toLowerCase();
        candidates = candidates.filter((l) => l.equipment_type.toLowerCase() === eq);
      }
      if (pickup_after) {
        candidates = candidates.filter((l) => l.pickup_datetime >= pickup_after);
      }
      if (max_weight) {
        candidates = candidates.filter((l) => l.weight <= max_weight);
      }

      const originTokens = tokenize(origin);
      const destTokens = tokenize(destination);

      const ranked = candidates
        .map((load) => {
          const originScore = locationMatchScore(load.origin, originTokens);
          const destScore = locationMatchScore(load.destination, destTokens);
          // Boost matches; tiebreak by lower rate (better margin) then by miles.
          const relevance = originScore * 2 + destScore * 2;
          return { load, relevance };
        })
        .filter((r) => {
          // If user provided origin/destination, only keep loads with at least one hit
          if (originTokens.length === 0 && destTokens.length === 0) return true;
          return r.relevance > 0;
        })
        .sort((a, b) => {
          if (b.relevance !== a.relevance) return b.relevance - a.relevance;
          return a.load.loadboard_rate - b.load.loadboard_rate;
        })
        .slice(0, limit)
        .map((r) => r.load);

      return { loads: ranked, total: ranked.length };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/v1/loads/:load_id",
    {
      preHandler: app.requireApiKey,
      schema: {
        params: z.object({ load_id: z.string().min(1) }),
        response: { 200: LoadSchema },
      },
    },
    async (req) => {
      const snap = await app.db.collection("loads").doc(req.params.load_id).get();
      if (!snap.exists) {
        throw app.httpErrors.notFound(`Load ${req.params.load_id} does not exist`);
      }
      return snap.data() as z.infer<typeof LoadSchema>;
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    "/v1/loads/:load_id/book",
    {
      preHandler: app.requireApiKey,
      schema: {
        params: z.object({ load_id: z.string().min(1) }),
        body: BookBody,
        response: { 200: BookResponse },
      },
    },
    async (req) => {
      const ref = app.db.collection("loads").doc(req.params.load_id);
      const result = await app.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { error: "not_found" as const };
        const load = snap.data() as z.infer<typeof LoadSchema>;
        if (load.status === "booked") {
          return { error: "already_booked" as const, load };
        }
        const updated: z.infer<typeof LoadSchema> = {
          ...load,
          status: "booked",
          booked_by_mc: req.body.mc_number.replace(/[^0-9]/g, ""),
          agreed_rate: req.body.agreed_rate,
          booked_at: new Date().toISOString(),
        };
        tx.set(ref, updated);
        return { error: null, load: updated };
      });

      if (result.error === "not_found") {
        throw app.httpErrors.notFound(`Load ${req.params.load_id} does not exist`);
      }
      if (result.error === "already_booked") {
        throw app.httpErrors.conflict(`Load ${req.params.load_id} is already booked`);
      }

      return {
        booked: true,
        load: result.load!,
        transfer_message:
          "Transfer was successful, you can wrap up the conversation. A sales representative will follow up shortly to confirm pickup details.",
      };
    },
  );
}
