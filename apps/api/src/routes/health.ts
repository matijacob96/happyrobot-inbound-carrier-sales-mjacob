import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    status: "ok",
    service: "hr-api",
    uptime_s: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  }));
}
