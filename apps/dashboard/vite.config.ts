import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Vite dev/preview servers proxy /api/* to the API and inject x-api-key
 * server-side, mirroring what the nginx BFF does in production. This way the
 * dashboard code only ever talks to /api on the same origin and never sees a
 * credential.
 *
 * Pull API_KEY from the repo-root .env (same file the API uses), so the
 * developer doesn't have to duplicate it.
 */
export default defineConfig(({ mode }) => {
  const repoRoot = resolve(here, "../..");
  const env = loadEnv(mode, repoRoot, "");
  const upstream = env.VITE_DEV_API_UPSTREAM ?? "http://localhost:8080";
  const apiKey = env.API_KEY ?? "";

  const apiProxy: ProxyOptions = {
    target: upstream,
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api/, ""),
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq) => {
        if (apiKey) proxyReq.setHeader("x-api-key", apiKey);
      });
    },
  };

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(here, "src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: { "/api": apiProxy },
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
      proxy: { "/api": apiProxy },
    },
  };
});
