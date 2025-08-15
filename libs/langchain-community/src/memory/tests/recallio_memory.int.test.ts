/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { randomUUID } from "crypto";
import { RecallioMemory } from "../recallio.js";

const sessionId = randomUUID(); // Unique per user/session

test("Test managed RecallIO memory", async () => {
  const memory = new RecallioMemory({
    sessionId,
    apiKey: process.env.RECALLIO_API_KEY!,
    projectId: process.env.RECALLIO_PROJECT_ID!,
  });

  const result1 = await memory.loadMemoryVariables({});
  // Check key exists regardless of initial state
  expect(result1).toHaveProperty("history");

  // Save Context
  await memory.saveContext(
    { input: "Hi, my name is Guillaume" },
    { response: "Nice to meet you, Guillaume" }
  );
  
  // Wait 1 second for the memory to be indexed
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Query to trigger semantic recall
  const result2 = await memory.loadMemoryVariables({ input: "Name" });
  const { history } = result2 as { history: string | any[] };

  if (typeof history === "string") {
    expect(history).toContain("Guillaume");
  } else if (Array.isArray(history)) {
    const serialized = history
      .map((m: any) =>
        m && typeof m === "object" && "content" in m ? m.content : String(m)
      )
      .join("\n");
    expect(serialized).toContain("Guillaume");
  } else {
    throw new Error("Returned history is neither string nor array");
  }
});
