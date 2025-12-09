import { test, expect, vi, describe } from "vitest";
import { TavilyGetResearch } from "../tavily-get-research.js";
import {
  TavilyResearchAPIWrapper,
  TavilyGetResearchResponse,
} from "../utils.js";

/**
 * A test implementation of TavilyResearchAPIWrapper that doesn't need API keys
 */
class TestTavilyResearchAPIWrapper extends TavilyResearchAPIWrapper {
  constructor() {
    // Pass a dummy key
    super({ tavilyApiKey: "test-key" });

    this.tavilyApiKey = "test-key";
  }

  // Mock the getResearch method to return what we want
  async getResearch(): Promise<TavilyGetResearchResponse> {
    // This is overridden by mockImplementation in each test
    return {
      request_id: "test-request-id",
      created_at: "2024-01-01T00:00:00Z",
      completed_at: "2024-01-01T00:01:00Z",
      status: "completed",
      input: "test input",
      model: "auto",
      content: "Test research content",
      sources: [],
      response_time: 0,
    };
  }
}

describe("TavilyGetResearch", () => {
  test("initializes with custom parameters", () => {
    const mockWrapper = new TestTavilyResearchAPIWrapper();
    const tool = new TavilyGetResearch({
      apiWrapper: mockWrapper,
      name: "custom_get_research",
      description: "Custom description",
    });

    expect(tool.name).toBe("custom_get_research");
    expect(tool.description).toBe("Custom description");
  });

  test("initializes with custom apiWrapper", () => {
    const mockWrapper = new TestTavilyResearchAPIWrapper();
    const tool = new TavilyGetResearch({ apiWrapper: mockWrapper });

    // Using a type assertion to access the private property
    expect(
      (tool as unknown as { apiWrapper: TestTavilyResearchAPIWrapper })
        .apiWrapper
    ).toBe(mockWrapper);
  });

  test("successfully retrieves research results", async () => {
    const mockResult: TavilyGetResearchResponse = {
      request_id: "test-request-id",
      created_at: "2024-01-01T00:00:00Z",
      completed_at: "2024-01-01T00:01:00Z",
      status: "completed",
      input: "What is the capital of France?",
      model: "auto",
      content: "The capital of France is Paris.",
      sources: [
        {
          title: "France - Wikipedia",
          url: "https://en.wikipedia.org/wiki/France",
          score: 0.95,
        },
      ],
      response_time: 1.5,
    };

    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the getResearch method for this test
    mockWrapper.getResearch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.getResearch;

    const tool = new TavilyGetResearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      requestId: "test-request-id",
    });

    expect(mockWrapper.getResearch).toHaveBeenCalledWith("test-request-id");

    expect(result).toEqual(mockResult);
  });

  test("handles pending status", async () => {
    const mockResult: TavilyGetResearchResponse = {
      request_id: "test-request-id",
      created_at: "2024-01-01T00:00:00Z",
      completed_at: "",
      status: "pending",
      input: "What is the capital of France?",
      model: "auto",
      content: "",
      sources: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the getResearch method for this test
    mockWrapper.getResearch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.getResearch;

    const tool = new TavilyGetResearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      requestId: "test-request-id",
    });

    expect(result).toEqual(mockResult);
    expect(result.status).toBe("pending");
  });

  test("handles in_progress status", async () => {
    const mockResult: TavilyGetResearchResponse = {
      request_id: "test-request-id",
      created_at: "2024-01-01T00:00:00Z",
      completed_at: "",
      status: "in_progress",
      input: "What is the capital of France?",
      model: "auto",
      content: "",
      sources: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the getResearch method for this test
    mockWrapper.getResearch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.getResearch;

    const tool = new TavilyGetResearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      requestId: "test-request-id",
    });

    expect(result).toEqual(mockResult);
    expect(result.status).toBe("in_progress");
  });

  test("handles failed status", async () => {
    const mockResult: TavilyGetResearchResponse = {
      request_id: "test-request-id",
      created_at: "2024-01-01T00:00:00Z",
      completed_at: "2024-01-01T00:01:00Z",
      status: "failed",
      input: "What is the capital of France?",
      model: "auto",
      content: "",
      sources: [],
      response_time: 1.0,
    };

    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the getResearch method for this test
    mockWrapper.getResearch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.getResearch;

    const tool = new TavilyGetResearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      requestId: "test-request-id",
    });

    expect(result).toEqual(mockResult);
    expect(result.status).toBe("failed");
  });

  test("handles API errors", async () => {
    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the getResearch method for this test
    mockWrapper.getResearch = vi
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("API error"))
      ) as typeof mockWrapper.getResearch;

    const tool = new TavilyGetResearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      requestId: "test-request-id",
    });

    expect(result).toEqual({ error: "API error" });
  });

  test("handles non-standard errors", async () => {
    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the getResearch method for this test
    mockWrapper.getResearch = vi
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("String error without message property"))
      ) as typeof mockWrapper.getResearch;

    const tool = new TavilyGetResearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      requestId: "test-request-id",
    });

    expect(result).toEqual({
      error: "String error without message property",
    });
  });
});
