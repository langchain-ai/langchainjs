import { langchainConfig, type ConfigArray } from "@langchain/eslint";

const config: ConfigArray = [
  ...langchainConfig,
  {
    files: ["src/chat_models/api-types.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
];

export default config;
