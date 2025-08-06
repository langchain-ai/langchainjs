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
      exclude: [
        "src/load/**/*.ts",
        "src/**/*.int.test.ts",
        "src/tests/utils.ts",
      ],
      thresholds: {
        statements: 96,
        branches: 91,
        functions: 81,
        lines: 96,
      },
    },
  },
});
