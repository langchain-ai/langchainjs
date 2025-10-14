import { langchainConfig } from "@langchain/eslint";

export default [
  ...langchainConfig,
  {
    files: ["src/middleware.ts"],
    rules: {
      "import/no-extraneous-dependencies": "off",
    },
  },
];
