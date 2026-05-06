import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  API_KEY: z.string().min(8, "API_KEY must be at least 8 characters"),

  FIREBASE_PROJECT_ID: z.string().min(1),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),

  FMCSA_API_KEY: z.string().min(1),
  FMCSA_BASE_URL: z.string().url().default("https://mobile.fmcsa.dot.gov/qc/services"),
  FMCSA_CACHE_TTL_HOURS: z.coerce.number().int().positive().default(24),
  // Set to "true" to bypass the FMCSA HTTP call and accept any MC with 6+ digits.
  // Useful for local development from non-US IPs (FMCSA geo-blocks the endpoint).
  FMCSA_MOCK: z.coerce.boolean().default(false),

  CORS_ORIGINS: z.string().default("*"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function parseCorsOrigins(raw: string): string[] | true {
  if (raw.trim() === "*") return true;
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}
