import { test, expect } from "vitest";
import { zkStashMemoryMiddleware } from "../memory.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const apiKey = process.env.ZKSTASH_API_KEY;

test.skipIf(!apiKey)("ZkStashMemoryMiddleware integration test", async () => {
  const middleware = zkStashMemoryMiddleware({
    apiKey,
    schemas: ["user_preferences"],
    filters: {
      agentId: "integration-test-agent",
      threadId: "test-thread-" + Date.now(),
    },
  });

  // 1. Test beforeModel (Retrieval)
  const state1 = {
    messages: [new HumanMessage("Who is the user?")],
  };
  const result1 = await middleware.beforeModel(state1);
  if (result1) {
    expect(Array.isArray(result1.messages)).toBe(true);
  }

  // 2. Test afterModel (Extraction)
  const state2 = {
    messages: [
      new HumanMessage("My name is Christian and I love coding."),
      new AIMessage("Nice to meet you Christian! I will remember you love coding."),
    ],
  };
  
  await middleware.afterModel(state2);

  // 3. Test beforeModel (Retrieval after extraction)
  // Extraction and indexing is async, so we retry a few times
  let result3: any;
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const state3 = {
      messages: [new HumanMessage("What do I love?")],
    };
    result3 = await middleware.beforeModel(state3);
    if (result3) break;
    console.log(`[Memory Int Test] Retry ${i+1}/5: no memories retrieved yet...`);
  }
  
  expect(result3).toBeDefined();
  expect(result3.messages[0].content).toContain("coding");
});
