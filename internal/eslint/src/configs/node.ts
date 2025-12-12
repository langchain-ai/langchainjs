import type { ConfigArray } from "typescript-eslint";

// Node.js specific ESLint configuration
const config: ConfigArray = [
  {
    name: "node/base",
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
      },
    },
    rules: {},
  },
];

export default config;
