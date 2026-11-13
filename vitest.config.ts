import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts: the signature tests are pure Node and need no React/Tailwind plugins.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
