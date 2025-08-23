import { langchainConfig, type ConfigArray } from "@langchain/eslint";

const config: ConfigArray = [
  ...langchainConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-process-env": "off",
    },
  },
];

export default config;
