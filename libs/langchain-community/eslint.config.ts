// @ts-nocheck
import { langchainConfig } from "@langchain/eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(...langchainConfig, {
  rules: {
    "import/no-extraneous-dependencies": "off",
  },
});
