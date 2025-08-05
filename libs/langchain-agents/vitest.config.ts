import { defineConfig } from "vitest/config";

const isIntegrationTest = process.env.VITEST_INTEGRATION === "true";

export default defineConfig({
  test: {
    include: isIntegrationTest
      ? ["src/**/*.int.test.ts"]
      : ["src/**/*.test.ts"],
    exclude: isIntegrationTest ? [] : ["src/**/*.int.test.ts"],
    coverage: {
      enabled: !isIntegrationTest,
      include: ["src/**/*.ts"],
      exclude: ["src/load/**/*.ts", "src/**/*.int.test.ts"],
      thresholds: {
        statements: 88,
        branches: 78,
        functions: 96,
        lines: 88,
      },
    },
  },
});
