import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./example/vitest.setup.ts"],
    testTimeout: 30000,
  },
});
