/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "./jest.env.cjs",
  modulePathIgnorePatterns: ["dist/", "docs/"],
  moduleNameMapper: {
    "^@langchain/core/(.*)$": "<rootDir>/../../langchain-core/$1",
    "^@langchain/core/utils/stream$": "<rootDir>/../../langchain-core/utils/stream.js",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["@swc/jest"],
  },
  transformIgnorePatterns: [
    "/node_modules/",
    "\\.pnp\\.[^\\/]+$",
    "./scripts/jest-setup-after-env.js",
  ],
  setupFiles: ["dotenv/config"],
  testTimeout: 20_000,
  passWithNoTests: true,
};
