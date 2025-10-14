import { langchainConfig, type ConfigArray } from "@langchain/eslint";

const config: ConfigArray = [
  ...langchainConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-process-env": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "no-instanceof/no-instanceof": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "import/no-extraneous-dependencies": "off",
    },
  },
];

export default config;
