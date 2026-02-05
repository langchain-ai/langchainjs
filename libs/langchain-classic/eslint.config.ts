import { defineConfig } from "eslint/config";
import { langchainConfig } from "@langchain/eslint";

export default defineConfig(
  // @ts-ignore - generic typescript-eslint configs have type conflicts, FIXME
  ...langchainConfig,
  {
    files: ["examples/**/*"],
    rules: {
      "no-process-env": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "import/no-extraneous-dependencies": "off",
      "no-instanceof/no-instanceof": "off",
      "@typescript-eslint/no-misused-promises": "off",
    },
  }
);
