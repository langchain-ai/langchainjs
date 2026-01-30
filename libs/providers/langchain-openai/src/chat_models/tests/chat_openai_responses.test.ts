import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "../index.js";

test("ChatOpenAI sends service_tier when using useResponsesApi: true", () => {
  // 1. Setup: Initializing model
  const model = new ChatOpenAI({
    model: "gpt-4o",
    apiKey: "test-key",
    useResponsesApi: true,
    service_tier: "priority", // Target param
  });

  // 2. Action: Fetching internal params
  // @ts-expect-error accessing private/protected method for testing
  const params = model.invocationParams();

  // 3. Assertion: Verifying service_tier exists
  console.log("Params generated:", params);
  
  expect(params.service_tier).toBe("priority");
});

test("ChatOpenAI does NOT send service_tier if not provided", () => {
  const model = new ChatOpenAI({
    model: "gpt-4o",
    apiKey: "test-key",
    useResponsesApi: true,
    // service_tier not provided
  });

  // @ts-expect-error accessing private/protected method
  const params = model.invocationParams();

  expect(params.service_tier).toBeUndefined();
});