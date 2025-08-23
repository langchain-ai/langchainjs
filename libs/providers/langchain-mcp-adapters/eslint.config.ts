import { langchainConfig, type ConfigArray } from "@langchain/eslint";

const config: ConfigArray = [
  ...langchainConfig,
  {
    // Override parser options for examples directory
    files: ["examples/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.examples.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "import/no-extraneous-dependencies": "off",
      "no-process-env": "off",
    },
  },
  {
    // Override parser options for test files
    files: ["__tests__/**/*.ts", "**/*.test.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.tests.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];

export default config;
