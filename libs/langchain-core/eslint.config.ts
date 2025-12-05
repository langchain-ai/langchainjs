import { langchainConfig, type ConfigArray } from "@langchain/eslint";

const config: ConfigArray = [
  ...langchainConfig,
  {
    ignores: ["src/utils/zod-to-json-schema/**"],
  },
];
export default config;
