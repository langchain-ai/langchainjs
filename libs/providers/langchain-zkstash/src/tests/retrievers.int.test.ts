import { test, expect } from "vitest";
import { ZkStashRetriever } from "../retrievers.js";

const apiKey = process.env.ZKSTASH_API_KEY;

test.skipIf(!apiKey)("ZkStashRetriever integration test", async () => {
  const retriever = new ZkStashRetriever({
    apiKey,
    filters: {
      agentId: "integration-test-agent",
    },
  });

  const results = await retriever.invoke("What is the user's favorite color?");
  
  // We expect a valid response (even if empty list)
  expect(Array.isArray(results)).toBe(true);
});
