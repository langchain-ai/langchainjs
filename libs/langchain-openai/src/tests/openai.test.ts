import { test, expect } from "@jest/globals";

// This is required while there are no (non integration) tests
// inside this package. Otherwise, jest will complain about
// "No tests found, exiting with code 1"
test("Placeholder", () => {
  expect(true).toBe(true);
});
