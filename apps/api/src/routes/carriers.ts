import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { FmcsaClient } from "../lib/fmcsa.js";

const VerifyBody = z.object({
  mc_number: z
    .string()
    .min(2, "mc_number is required")
    .max(20, "mc_number is too long"),
});

const VerifyResponse = z.object({
  mc_number: z.string(),
  eligible: z.boolean(),
  carrier_name: z.string().optional(),
  dot_number: z.string().optional(),
  allowed_to_operate: z.boolean().optional(),
  reasons: z.array(z.string()),
  cached: z.boolean(),
  verified_at: z.string(),
});

export async function carriersRoutes(app: FastifyInstance): Promise<void> {
  const fmcsa = new FmcsaClient(
    app.config.FMCSA_BASE_URL,
    app.config.FMCSA_API_KEY,
    app.config.FMCSA_MOCK,
  );
  if (app.config.FMCSA_MOCK) {
    app.log.warn("FMCSA_MOCK=true — carrier verification is in mock mode");
  }
  const cacheTtlMs = app.config.FMCSA_CACHE_TTL_HOURS * 60 * 60 * 1000;

  app.withTypeProvider<ZodTypeProvider>().post(
    "/v1/carriers/verify",
    {
      preHandler: app.requireApiKey,
      schema: {
        body: VerifyBody,
        response: { 200: VerifyResponse },
      },
    },
    async (req) => {
      const { mc_number } = req.body;
      const normalized = mc_number.replace(/[^0-9]/g, "");
      const docRef = app.db.collection("carriers").doc(normalized);

      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data() as {
          eligible: boolean;
          carrier_name?: string;
          dot_number?: string;
          allowed_to_operate?: boolean;
          reasons: string[];
          verified_at: string;
        };
        const verifiedMs = new Date(data.verified_at).getTime();
        if (Date.now() - verifiedMs < cacheTtlMs) {
          return { ...data, mc_number: normalized, cached: true };
        }
      }

      const fresh = await fmcsa.verifyMcNumber(normalized);
      const now = new Date().toISOString();
      const record = {
        mc_number: normalized,
        eligible: fresh.eligible,
        carrier_name: fresh.carrier_name,
        dot_number: fresh.dot_number,
        allowed_to_operate: fresh.allowed_to_operate,
        reasons: fresh.reasons,
        verified_at: now,
      };

      await docRef.set(record, { merge: true });
      return { ...record, cached: false };
    },
  );
}
