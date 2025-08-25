const { awaitAllCallbacks } = require("@langchain/core/callbacks/promises");

afterAll(awaitAllCallbacks);

// Allow console.log to be disabled in tests
if (process.env.DISABLE_CONSOLE_LOGS === "true") {
  console.log = jest.fn();
}
