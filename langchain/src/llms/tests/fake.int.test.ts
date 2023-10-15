import { describe, test, expect } from "@jest/globals";
import { FakeListLLM } from "../fake.js";

describe("Test FakeListLLM", () => {
  test("Should exist", async () => {
    const llm = new FakeListLLM({ responses: ["test response"] });
    const response = await llm.call("test prompt");

    expect(typeof response).toBe("string");
  });

  test("Should return responses in order", async () => {
    const llm = new FakeListLLM({
      responses: ["test response 1", "test response 2"],
    });
    const response1 = await llm.call("test prompt");
    const response2 = await llm.call("test prompt");

    expect(response1).toBe("test response 1");
    expect(response2).toBe("test response 2");
  });

  test("Should reset index when all responses have been returned", async () => {
    const llm = new FakeListLLM({
      responses: ["test response 1", "test response 2"],
    });
    const response1 = await llm.call("test prompt");
    const response2 = await llm.call("test prompt");
    const response3 = await llm.call("test prompt");

    expect(response1).toBe("test response 1");
    expect(response2).toBe("test response 2");
    expect(response3).toBe("test response 1");
  });

  test("Should stream responses if requested", async () => {
    const chunks = [];
    const llm = new FakeListLLM({
      responses: ["test response 1", "test response 2"],
    });
    const response = await llm.stream("test prompt");
    for await (const chunk of response) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("test response 1");
  });

  test("Should return responses in order with sleep", async () => {
    const llm = new FakeListLLM({
      responses: ["test response 1", "test response 2"],
      sleep: 10,
    });
    const response1 = await llm.call("test prompt");
    const response2 = await llm.call("test prompt");

    expect(response1).toBe("test response 1");
    expect(response2).toBe("test response 2");
  }, 30000);
});
