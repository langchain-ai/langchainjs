import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      enabled: true,
      include: ["src/**/*.ts"],
      exclude: ["src/load/**/*.ts"],
      thresholds: {
        statements: 88,
        branches: 78,
        functions: 96,
        lines: 88,
      },
    },
  },
});
