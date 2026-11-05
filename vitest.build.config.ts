import { defineConfig } from "vite-plus";

// Slow tests that run a real `vite build` and inspect the output.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/build/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
