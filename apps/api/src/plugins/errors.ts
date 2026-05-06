import fp from "fastify-plugin";
import { ZodError } from "zod";

interface MaybeError {
  validation?: unknown[];
  statusCode?: number;
  name?: string;
  message?: string;
}

export default fp(
  async function errorsPlugin(app) {
    app.setErrorHandler((rawError, req, reply) => {
      const error = rawError as unknown as MaybeError;
      // Zod validation errors (from fastify-type-provider-zod)
      if (rawError instanceof ZodError || error.validation) {
        const issues =
          rawError instanceof ZodError ? rawError.issues : (error.validation ?? []);
        req.log.info({ issues }, "validation error");
        return reply.code(400).send({
          error: "bad_request",
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: issues,
        });
      }

      const status = error.statusCode ?? 500;
      const code =
        status === 404
          ? "NOT_FOUND"
          : status === 401
            ? "UNAUTHORIZED"
            : status === 409
              ? "CONFLICT"
              : status >= 500
                ? "INTERNAL_ERROR"
                : "BAD_REQUEST";

      if (status >= 500) {
        req.log.error({ err: rawError }, "unhandled error");
      } else {
        req.log.warn({ err: error.message, status }, "request error");
      }

      reply.code(status).send({
        error: status >= 500 ? "internal_error" : (error.name ?? "error"),
        code,
        message:
          status >= 500 && app.config.NODE_ENV === "production"
            ? "Something went wrong"
            : (error.message ?? "error"),
      });
    });

    app.setNotFoundHandler((req, reply) => {
      reply.code(404).send({
        error: "not_found",
        code: "NOT_FOUND",
        message: `Route ${req.method} ${req.url} not found`,
      });
    });
  },
  { name: "errors" },
);
