import { defineConfig } from "eslint/config";
import { langchainConfig } from "@langchain/eslint";

export default defineConfig(...langchainConfig, {
  files: ["examples/**/*.ts"],
  rules: {
    "no-process-env": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-floating-promises": "off",
    "no-instanceof/no-instanceof": "off",
    "@typescript-eslint/no-misused-promises": "off",
  },
});
