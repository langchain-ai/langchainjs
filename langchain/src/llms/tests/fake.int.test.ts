import { describe, test, expect } from "@jest/globals";
import { FakeListLLM, FakeListStreamingLLM } from "../fake.js";

describe("Test FakeListLLM", () => {
  test("Should exist", async () => {
    const llm = new FakeListLLM({ responses: ["test response"] });
    const response = await llm.call("test prompt");

    expect(typeof response).toBe("string");
  });

  test("Should return responses in order", async () => {
    const llm = new FakeListLLM({ responses: ["test response 1", "test response 2"] });
    const response1 = await llm.call("test prompt");
    const response2 = await llm.call("test prompt");

    expect(response1).toBe("test response 1");
    expect(response2).toBe("test response 2");
  })

  test('Should reset index when all responses have been returned', async () => {
    const llm = new FakeListLLM({ responses: ["test response 1", "test response 2"] });
    const response1 = await llm.call("test prompt");
    const response2 = await llm.call("test prompt");
    const response3 = await llm.call("test prompt");

    expect(response1).toBe("test response 1");
    expect(response2).toBe("test response 2");
    expect(response3).toBe('test response 1')
  })
})

describe("Test FakeListStreamingLLM", () => {
  test("Should exist", async () => {
    const llm = new FakeListStreamingLLM({ responses: ["test response"] });
    const response = await llm.call("test prompt");

    expect(typeof response).toBe("string");
  })

  test("Should return responses in order with sleep", async () => {
    const llm = new FakeListStreamingLLM({ responses: ["test response 1", "test response 2"], sleep: 10 });
    const response1 = await llm.call("test prompt");
    const response2 = await llm.call("test prompt");

    expect(response1).toBe("test response 1");
    expect(response2).toBe("test response 2");
  }, 30000)
})