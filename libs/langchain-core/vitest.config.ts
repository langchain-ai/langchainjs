import {
  configDefaults,
  defineConfig,
  type UserConfigExport,
} from "vitest/config";

export default defineConfig((env) => {
  const common: UserConfigExport = {
    test: {
      environment: "node",
      hideSkippedTests: true,
      globals: true,
      testTimeout: 30_000,
      maxWorkers: 0.5,
      exclude: ["**/*.int.test.ts", ...configDefaults.exclude],
      setupFiles: ["dotenv/config", "vitest.setup.js"],
    },
  };

  if (env.mode === "int") {
    return {
      test: {
        ...common.test,
        globals: false,
        testTimeout: 100_000,
        exclude: configDefaults.exclude,
        include: ["**/*.int.test.ts"],
        name: "int",
      },
    } satisfies UserConfigExport;
  }

  return {
    test: {
      ...common.test,
      include: configDefaults.include,
      typecheck: { enabled: true },
    },
  } satisfies UserConfigExport;
});
