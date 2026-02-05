import globals from "globals";
import type { ConfigArray } from "typescript-eslint";

// Browser specific ESLint configuration
const config: ConfigArray = [
  {
    name: "browser/base",
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Browser specific rules
      "no-restricted-globals": [
        "error",
        {
          name: "window",
          message: "Use globalThis instead of window for better compatibility.",
        },
      ],
    },
  },
];

export default config;
