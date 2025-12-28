import { test, expect } from "vitest";
import { ZkStashStore } from "../storage.js";

const apiKey = process.env.ZKSTASH_API_KEY;

test.skipIf(!apiKey)("ZkStashStore integration test", async () => {
  const store = new ZkStashStore({
    apiKey,
    agentId: "integration-test-agent"
  });

  // Test Mapping Key -> Schema
  // We use "facts" which was registered in setup_integration.ts
  const factData = { fact: "The integration test is running with Schema-as-Key pattern." };
  
  await store.mset([["facts", factData]]);

  // Wait for indexing with retries
  let values: any[] = [];
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    values = await store.mget(["facts"]);
    if (values[0]) break;
    console.log(`[Storage Int Test] Retry ${i+1}/5: mget(["facts"]) still undefined...`);
  }

  expect(values[0]).toBeDefined();
  expect(values[0].fact).toBe(factData.fact);

  // Test Search (semantic)
  const results = await store.search("integration test", { kind: "facts" });
  expect(Array.isArray(results)).toBe(true);
  // Search might take even longer or fail if semantic distance is high, but we expect it to eventually work
  expect(results.length).toBeGreaterThan(0);
});
