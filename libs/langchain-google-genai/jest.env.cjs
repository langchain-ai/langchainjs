const { TestEnvironment } = require("jest-environment-node");
const dotenv = require("dotenv");

class AdjustedTestEnvironmentToSupportFloat32Array extends TestEnvironment {
  constructor(config, context) {
    // Make `instanceof Float32Array` return true in tests
    // to avoid https://github.com/xenova/transformers.js/issues/57 and https://github.com/jestjs/jest/issues/2549
    super(config, context);
    this.global.Float32Array = Float32Array;
    
    dotenv.config({ path: "/home/bahar/langchainjs/.env" });
    console.log("GOOGLE_API_KEY from jest.env.cjs:", process.env.GOOGLE_API_KEY);
    this.global.process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  }
}

module.exports = AdjustedTestEnvironmentToSupportFloat32Array;
