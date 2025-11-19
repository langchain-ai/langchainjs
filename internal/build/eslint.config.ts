import { langchainConfig, type ConfigArray } from "@langchain/eslint";

const config: ConfigArray = [
  ...langchainConfig,
  {
    rules: {
      "no-process-env": "off",
    },
  },
];

export default config;
