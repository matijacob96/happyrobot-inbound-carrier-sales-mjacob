import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { loadConfig, parseCorsOrigins, type AppConfig } from "./config.js";
import firestorePlugin from "./plugins/firestore.js";
import authPlugin from "./plugins/auth.js";
import errorsPlugin from "./plugins/errors.js";

import { healthRoutes } from "./routes/health.js";
import { carriersRoutes } from "./routes/carriers.js";
import { loadsRoutes } from "./routes/loads.js";
import { callsRoutes } from "./routes/calls.js";
import { metricsRoutes } from "./routes/metrics.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export async function buildApp(config: AppConfig = loadConfig()) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss.l", colorize: true } }
          : undefined,
    },
    disableRequestLogging: false,
    trustProxy: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate("config", config);

  await app.register(sensible);
  await app.register(cors, {
    origin: parseCorsOrigins(config.CORS_ORIGINS),
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "x-api-key"],
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    allowList: ["127.0.0.1", "::1"],
  });

  await app.register(errorsPlugin);
  await app.register(firestorePlugin, {
    projectId: config.FIREBASE_PROJECT_ID,
    emulatorHost: config.FIRESTORE_EMULATOR_HOST,
  });
  await app.register(authPlugin, { apiKey: config.API_KEY });

  await app.register(healthRoutes);
  await app.register(carriersRoutes);
  await app.register(loadsRoutes);
  await app.register(callsRoutes);
  await app.register(metricsRoutes);

  return app;
}

async function start() {
  const config = loadConfig();
  const app = await buildApp(config);
  try {
    await app.listen({ host: "0.0.0.0", port: config.PORT });
    app.log.info(
      {
        port: config.PORT,
        env: config.NODE_ENV,
        firestoreEmulator: Boolean(config.FIRESTORE_EMULATOR_HOST),
      },
      "hr-api is up",
    );
  } catch (err) {
    app.log.error(err, "failed to start");
    process.exit(1);
  }

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, async () => {
      app.log.info({ sig }, "received signal, shutting down");
      await app.close();
      process.exit(0);
    });
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  void start();
}
