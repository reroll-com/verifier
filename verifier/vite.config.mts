import react from "@vitejs/plugin-react";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");

  return {
    root,
    plugins: [react()],
    base: env.VERIFIER_BASE?.trim() || "/",
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
