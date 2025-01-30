import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { afterAll, jest } from "@jest/globals";

// Set default test environment variables if not set
process.env.PAYMAN_ENVIRONMENT = process.env.PAYMAN_ENVIRONMENT || "sandbox";

afterAll(awaitAllCallbacks);

// Allow console.log to be disabled in tests
if (process.env.DISABLE_CONSOLE_LOGS === "true") {
  console.log = jest.fn();
}
