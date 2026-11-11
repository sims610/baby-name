import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import istanbul from "vite-plugin-istanbul";

export default defineConfig({
  build: { sourcemap: true },
  plugins: [
    react(),
    // Instruments source for Playwright coverage (collected via playwright-test-coverage + nyc).
    istanbul({
      include: ["src/**/*", "index.tsx"],
      exclude: ["node_modules", "tests"],
      extension: [".ts", ".tsx"],
      requireEnv: false,
    }),
  ],
  resolve: {
    // `@/` points at `src/`, e.g. `import CreateAccount from "@/components/register/CreateAccount"`.
    // Keep in sync with `paths` in tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
});
