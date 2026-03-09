import path from "node:path";
import url from "node:url";
import { langchainConfig, type ConfigArray } from "@langchain/eslint";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const config: ConfigArray = [
  ...langchainConfig,
  {
    // Allow imports from peerDependencies in source files
    files: ["src/**/*.ts"],
    rules: {
      "import-x/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: false,
          peerDependencies: true,
        },
      ],
    },
  },
  {
    // Override parser options for examples directory
    files: ["examples/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./examples/tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "import-x/no-extraneous-dependencies": "off",
      "no-process-env": "off",
    },
  },
  {
    // Override parser options for test files
    files: ["__tests__/**/*.ts", "**/*.test.ts", "**/*.test-d.ts", "src/tests/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.tests.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "import-x/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: true,
        },
      ],
    },
  },
];

export default config;
