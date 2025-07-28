import { test, expect, jest, describe } from "@jest/globals";
import { TavilyExtract } from "../tavily-extract.js";
import { TavilyExtractAPIWrapper, TavilyExtractResponse } from "../utils.js";

/**
 * A test implementation of TavilyExtractAPIWrapper that doesn't need API keys
 */
class TestTavilyExtractAPIWrapper extends TavilyExtractAPIWrapper {
  constructor() {
    // Pass a dummy key
    super({ tavilyApiKey: "test-key" });

    this.tavilyApiKey = "test-key";
  }

  // Mock the raw results method to return what we want
  async rawResults(): Promise<TavilyExtractResponse> {
    // This is overridden by mockImplementation in each test
    return {
      results: [],
      failed_results: [],
      response_time: 0,
    };
  }
}

describe("TavilyExtract", () => {
  test("initializes with custom parameters", () => {
    const mockWrapper = new TestTavilyExtractAPIWrapper();
    const tool = new TavilyExtract({
      apiWrapper: mockWrapper,
      name: "custom_extract",
      description: "Custom description",
      extractDepth: "advanced",
      includeImages: true,
    });

    expect(tool.name).toBe("custom_extract");
    expect(tool.description).toBe("Custom description");
    expect(tool.extractDepth).toBe("advanced");
    expect(tool.includeImages).toBe(true);
  });

  test("initializes with custom apiWrapper", () => {
    const mockWrapper = new TestTavilyExtractAPIWrapper();
    const tool = new TavilyExtract({ apiWrapper: mockWrapper });

    // Using a type assertion to access the private property
    expect(
      (tool as unknown as { apiWrapper: TestTavilyExtractAPIWrapper })
        .apiWrapper
    ).toBe(mockWrapper);
  });

  test("successfully extracts content from URLs", async () => {
    const mockResult: TavilyExtractResponse = {
      results: [
        {
          url: "https://example.com",
          raw_content: "Example content",
          images: [],
        },
      ],
      failed_results: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyExtractAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyExtract({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      urls: ["https://example.com"],
    });

    expect(mockWrapper.rawResults).toHaveBeenCalledWith({
      urls: ["https://example.com"],
    });

    expect(result).toEqual(mockResult);
  });

  test("respects input parameters", async () => {
    const mockResult: TavilyExtractResponse = {
      results: [
        {
          url: "https://example.com",
          raw_content: "Content",
          images: ["image.jpg"],
        },
      ],
      failed_results: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyExtractAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyExtract({ apiWrapper: mockWrapper });
    await tool.invoke({
      urls: ["https://example.com"],
      extractDepth: "advanced",
      includeImages: true,
    });

    expect(mockWrapper.rawResults).toHaveBeenCalledWith({
      urls: ["https://example.com"],
      extractDepth: "advanced",
      includeImages: true,
    });
  });

  test("uses default parameters when not provided in input", async () => {
    const mockResult: TavilyExtractResponse = {
      results: [
        {
          url: "https://example.com",
          raw_content: "Content",
          images: [],
        },
      ],
      failed_results: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyExtractAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    // Now with our fixed implementation, the default values should be respected
    const tool = new TavilyExtract({
      apiWrapper: mockWrapper,
      extractDepth: "advanced",
      includeImages: true,
    });

    const invokeResult = await tool.invoke({
      urls: ["https://example.com"],
    });

    // Check that the tool correctly uses the default values we set during initialization
    expect(mockWrapper.rawResults).toHaveBeenCalledWith({
      urls: ["https://example.com"],
      extractDepth: "advanced", // Now correctly using the constructor value
      includeImages: true, // Now correctly using the constructor value
    });

    expect(invokeResult).toEqual(mockResult);
  });

  test("handles API errors", async () => {
    const mockWrapper = new TestTavilyExtractAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("API error"))
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyExtract({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      urls: ["https://example.com"],
    });

    expect(result).toEqual({ error: "API error" });
  });

  test("handles empty results", async () => {
    const mockResult: TavilyExtractResponse = {
      results: [],
      failed_results: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyExtractAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyExtract({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      urls: ["https://example.com"],
    });

    expect(result).toEqual({
      error: expect.stringContaining("No extracted results found"),
    });
  });

  test("handles all failed results", async () => {
    const mockResult: TavilyExtractResponse = {
      results: [],
      failed_results: [
        { url: "https://example.com", error: "Failed to extract" },
      ],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyExtractAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyExtract({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      urls: ["https://example.com"],
    });

    expect(result).toEqual({
      error: expect.stringContaining("No extracted results found"),
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

    const mockWrapper = new TestTavilyExtractAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyExtract({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      urls: ["https://example.com"],
      extractDepth: "basic",
    });

    expect(result).toEqual({
      error: expect.stringContaining(
        "Try a more detailed extraction using 'advanced' extractDepth"
      ),
    });
  });

  test("handles non-standard errors", async () => {
    const mockWrapper = new TestTavilyExtractAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("String error without message property"))
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyExtract({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      urls: ["https://example.com"],
    });

    expect(result).toEqual({
      error: expect.stringContaining("String error without message property"),
    });
  });
});
