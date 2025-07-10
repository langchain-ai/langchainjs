import { test, expect, jest, describe } from "@jest/globals";
import { TavilyMap } from "../tavily-map.js";
import {
  TavilyExtractResponse,
  TavilyMapAPIWrapper,
  TavilyMapResponse,
} from "../utils.js";

/**
 * A test implementation of TavilyExtractAPIWrapper that doesn't need API keys
 */
class TestTavilyMapAPIWrapper extends TavilyMapAPIWrapper {
  constructor() {
    // Pass a dummy key
    super({ tavilyApiKey: "test-key" });

    this.tavilyApiKey = "test-key";
  }

  // Mock the raw results method to return what we want
  async rawResults(): Promise<TavilyMapResponse> {
    // This is overridden by mockImplementation in each test
    return {
      base_url: "https://example.com",
      results: [],
      response_time: 0,
    };
  }
}

describe("TavilyMap", () => {
  test("initializes with custom parameters", () => {
    const mockWrapper = new TestTavilyMapAPIWrapper();
    const tool = new TavilyMap({
      apiWrapper: mockWrapper,
      name: "custom_map",
      description: "Custom description",
      maxDepth: 10,
      maxBreadth: 20,
      limit: 100,
      allowExternal: true,
      categories: ["Documentation"],
      selectPaths: ["example.com"],
      selectDomains: ["exclude.com"],
      excludePaths: ["exclude.com"],
      excludeDomains: ["exclude.com"],
    });

    expect(tool.name).toBe("custom_map");
    expect(tool.description).toBe("Custom description");
    expect(tool.maxDepth).toBe(10);
    expect(tool.maxBreadth).toBe(20);
    expect(tool.limit).toBe(100);
    expect(tool.allowExternal).toBe(true);
    expect(tool.categories).toEqual(["Documentation"]);
    expect(tool.selectPaths).toEqual(["example.com"]);
    expect(tool.selectDomains).toEqual(["exclude.com"]);
    expect(tool.excludePaths).toEqual(["exclude.com"]);
    expect(tool.excludeDomains).toEqual(["exclude.com"]);
  });

  test("initializes with custom apiWrapper", () => {
    const mockWrapper = new TestTavilyMapAPIWrapper();
    const tool = new TavilyMap({ apiWrapper: mockWrapper });

    // Using a type assertion to access the private property
    expect(
      (tool as unknown as { apiWrapper: TestTavilyMapAPIWrapper }).apiWrapper
    ).toBe(mockWrapper);
  });

  test("successfully maps content from URLs", async () => {
    const mockResult: TavilyMapResponse = {
      base_url: "https://example.com",
      results: ["https://example.com"],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyMapAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyMap({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      url: "https://example.com",
    });

    expect(mockWrapper.rawResults).toHaveBeenCalledWith({
      url: "https://example.com",
    });

    expect(result).toEqual(mockResult);
  });

  test("handles API errors", async () => {
    const mockWrapper = new TestTavilyMapAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("API error"))
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyMap({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      url: "https://example.com",
    });

    expect(result).toEqual({ error: "API error" });
  });

  test("handles empty results", async () => {
    const mockResult: TavilyMapResponse = {
      base_url: "https://example.com",
      results: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyMapAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyMap({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      url: "https://example.com",
    });

    expect(result).toEqual({
      error: expect.stringContaining("No map results found"),
    });
  });

  test("generates suggestions when extraction fails", async () => {
    const mockResult: TavilyExtractResponse = {
      results: [],
      failed_results: [
        { url: "https://example.com", error: "Failed to extract" },
      ],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyMapAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyMap({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      url: "https://example.com",
    });

    expect(result).toEqual({
      error: expect.stringContaining(
        "Try adding specific path filters using selectPaths"
      ),
    });
  });

  test("handles non-standard errors", async () => {
    const mockWrapper = new TestTavilyMapAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("String error without message property"))
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyMap({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      url: "https://example.com",
    });

    expect(result).toEqual({
      error: expect.stringContaining("String error without message property"),
    });
  });
});
