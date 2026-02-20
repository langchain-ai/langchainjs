import { langchainConfig, type ConfigArray } from "@langchain/eslint";

const config: ConfigArray = [
  ...langchainConfig,
  {
    files: ["src/api-types.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
];

export default config;
