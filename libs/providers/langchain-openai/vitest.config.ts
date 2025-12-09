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
      testTimeout: 30_000,
      maxWorkers: 0.5,
      exclude: ["**/*.int.test.ts", ...configDefaults.exclude],
      setupFiles: ["dotenv/config"],
    },
  };

  if (env.mode === "standard-unit") {
    return {
      test: {
        ...common.test,
        testTimeout: 100_000,
        exclude: configDefaults.exclude,
        include: ["**/*.standard.test.ts"],
        name: "standard-unit",
        environment: "node",
      },
    };
  }

  if (env.mode === "standard-int") {
    return {
      test: {
        ...common.test,
        testTimeout: 100_000,
        exclude: configDefaults.exclude,
        include: ["**/*.standard.int.test.ts"],
        name: "standard-int",
        environment: "node",
      },
    };
  }

  if (env.mode === "int") {
    return {
      test: {
        ...common.test,
        globals: false,
        testTimeout: 100_000,
        exclude: configDefaults.exclude,
        include: ["**/*.int.test.ts"],
        name: "int",
        environment: "node",
      },
    };
  }

  return {
    test: {
      ...common.test,
      environment: "node",
      include: configDefaults.include,
      // Disable typecheck in CI because dependency range tests run in isolated
      // Docker environments where workspace dependencies like @langchain/standard-tests
      // may not have their transitive dependencies properly resolved
      typecheck: { enabled: !process.env.CI },
    },
  };
});
