import { expect, test } from "@jest/globals";
import { v4 as uuid } from "uuid";
import { ZepMemory } from "../zep.js";

const sessionId = uuid();
const baseURL = "http://localhost:8000";
const zepMemory = new ZepMemory({ sessionId, baseURL });

beforeEach((done) => {
  setTimeout(done, 1000); // 1-second delay before each test case
});

test.skip("addMemory to Zep memory", async () => {
  await zepMemory.saveContext(
    { input: "Who was Octavia Butler?" },
    {
      response:
        "Octavia Estelle Butler (June 22, 1947 – " +
        "February 24, 2006) was an American science fiction author.",
    }
  );
});

test.skip("getMessages from Zep memory", async () => {
  const memoryVariables = await zepMemory.loadMemoryVariables({});
  console.log("memoryVariables", memoryVariables);

  // Check if memoryKey exists in the memoryVariables
  expect(memoryVariables).toHaveProperty(zepMemory.memoryKey);

  const messages = memoryVariables[zepMemory.memoryKey];

  // Check if messages is an array or string
  if (typeof messages === "string") {
    // In this case, we can at least expect a non-empty string.
    expect(messages.length).toBeGreaterThanOrEqual(1);
  } else if (Array.isArray(messages)) {
    expect(messages.length).toBeGreaterThanOrEqual(1);
  } else {
    console.log("failed to get messages: ", messages);
    // Fail the test because messages is neither string nor array
    throw new Error("Returned messages is neither string nor array");
  }
});
