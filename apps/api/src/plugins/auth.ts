import fp from "fastify-plugin";
import type { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    requireApiKey: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

interface AuthPluginOptions {
  apiKey: string;
}

const HEADER_NAME = "x-api-key";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export default fp<AuthPluginOptions>(
  async function authPlugin(app, opts) {
    const expected = opts.apiKey;

    app.decorate(
      "requireApiKey",
      async function requireApiKey(req: FastifyRequest, reply: FastifyReply) {
        const provided = req.headers[HEADER_NAME];
        const value = Array.isArray(provided) ? provided[0] : provided;

        if (!value || typeof value !== "string" || !timingSafeEqual(value, expected)) {
          req.log.warn(
            { ip: req.ip, route: req.routeOptions.url },
            "auth: missing or invalid api key",
          );
          await reply.code(401).send({
            error: "unauthorized",
            code: "INVALID_API_KEY",
            message: `Missing or invalid ${HEADER_NAME} header`,
          });
        }
      },
    );
  },
  { name: "auth" },
);
