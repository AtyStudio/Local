import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async ({ mode }) => {
  const envDir = path.resolve(import.meta.dirname, "..", "..");
  const env = loadEnv(mode, envDir, "");

  const port = Number(env.WEB_PORT || env.PORT || "3000");
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid WEB_PORT/PORT value: "${env.WEB_PORT || env.PORT}"`);
  }

  const basePath = env.BASE_PATH || "/";
  const apiTarget = env.VITE_API_URL || "http://localhost:8080";

  return {
    envDir,
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...(env.NODE_ENV !== "production" && env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    define: {
      "import.meta.env.VITE_PAYPAL_CLIENT_ID": JSON.stringify(env.PAYPAL_CLIENT_ID || ""),
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
