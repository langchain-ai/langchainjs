import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    hideSkippedTests: true,
    globals: true,
    testTimeout: 30_000,
    maxWorkers: 0.5,
    exclude: ["**/*.int.test.ts", ...configDefaults.exclude],
    include: configDefaults.include,
    typecheck: { enabled: true },
    setupFiles: ["dotenv/config"],
  },
});
