/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "./jest.env.cjs",
  modulePathIgnorePatterns: ["dist/", "docs/"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^p-retry$": "<rootDir>/scripts/p-retry-mock.cjs",
    "^p-queue$": "<rootDir>/scripts/p-queue-mock.cjs",
  },
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: false,
            decorators: false,
          },
          target: "es2022",
          loose: false,
          externalHelpers: false,
          keepClassNames: false,
          transform: {
            legacyDecorator: false,
            decoratorMetadata: false,
          },
        },
        module: {
          type: "commonjs",
        },
      },
    ],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@arcjet|srt-parser-2)/)",
    "\\.pnp\\.[^\\/]+$",
  ],
  setupFiles: ["dotenv/config"],
  setupFilesAfterEnv: ["./scripts/jest-setup-after-env.ts"],
  testTimeout: 20_000,
  collectCoverageFrom: ["src/**/*.ts"],
};
