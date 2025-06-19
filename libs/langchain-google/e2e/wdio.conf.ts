/// <reference types="webdriverio" />

if (!process.env.VITE_GOOGLE_API_KEY) {
  throw new Error(
    "VITE_GOOGLE_API_KEY is not set, but it is required to run the tests"
  );
}

export const config: WebdriverIO.Config = {
  tsConfigPath: "./tsconfig.node.json",
  specs: ["./test/**/*.ts"],
  logLevel: "error",
  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": {
        /**
         * run headless
         */
        args: ["headless"],
      },
    },
  ],
  /**
   * Start Vite server before running tests
   */
  services: [
    [
      "vite",
      {
        env: {
          VITE_GOOGLE_API_KEY: process.env.VITE_GOOGLE_API_KEY,
        },
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
};
