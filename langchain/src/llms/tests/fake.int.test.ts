import { describe, test, expect, jest } from "@jest/globals";
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

  test("Should return responses after sleep if requested", async () => {
    const llm = new FakeListLLM({
      responses: ["test response 1", "test response 2"],
      sleep: 10,
    });
    const sleepSpy = jest.spyOn(llm, "_sleep");

    await llm.call("test prompt");

    expect(sleepSpy).toHaveBeenCalledTimes(1);
  }, 3000);

  test("Should stream responses if requested", async () => {
    const llm = new FakeListLLM({
      responses: ["test response 1", "test response 2"],
    });
    const chunks = [];

    const response = await llm.stream("test prompt");
    for await (const chunk of response) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe("test response 1");
  });

  test("Should return responses in order when streaming", async () => {
    const llm = new FakeListLLM({
      responses: ["test response 1", "test response 2"],
    });
    const chunks1 = [];
    const chunks2 = [];

    const response1 = await llm.stream("test prompt");
    for await (const chunk of response1) {
      chunks1.push(chunk);
    }
    const response2 = await llm.stream("test prompt");
    for await (const chunk of response2) {
      chunks2.push(chunk);
    }

    expect(chunks1.join("")).toBe("test response 1");
    expect(chunks2.join("")).toBe("test response 2");
  });

  test("Should stream responses after sleep if requested", async () => {
    const llm = new FakeListLLM({
      responses: ["test response 1", "test response 2"],
      sleep: 10,
    });
    const sleepSpy = jest.spyOn(llm, "_sleep");
    const chunks = [];

    const response = await llm.stream("test prompt");
    for await (const chunk of response) {
      chunks.push(chunk);
    }

    expect(sleepSpy).toHaveBeenCalledTimes(chunks.length);
  }, 3000);
});
