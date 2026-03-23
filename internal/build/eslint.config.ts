import { langchainConfig, type ConfigArray } from "@langchain/eslint";

const config: ConfigArray = [
  ...langchainConfig,
  {
    rules: {
      "no-process-env": "off",
      "import-x/extensions": "off",
    },
  },
];

export default config;
